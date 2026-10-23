import { randomInt, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { RedisClientType } from "redis";
import { utcDateKey } from "../daily/date.js";
import { dailyPassage, generatePassage } from "../daily/passage.js";
import type { Keys } from "./keys.js";

const createRoundBody = z.object({
    mode: z.enum(["ranked", "practice"]),
});

// Redis keeps rounds a while after they expire, so a late submit gets
// "expired" instead of "not found". The expiresAt field is the real rule.
const ROUND_CLEANUP_GRACE_SECONDS = 60 * 60;
const ATTEMPT_KEY_TTL_SECONDS = 48 * 60 * 60;

export interface RoundDeps {
    redis: RedisClientType;
    keys: Keys;
    dailySeedSecret: string;
    roundTtlSeconds: number;
    now: () => Date;
}

export function roundsRouter(deps: RoundDeps) {
    const router = Router();

    router.post("/", async (req, res) => {
        const parsed = createRoundBody.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "invalid_body" });
            return;
        }
        const { mode } = parsed.data;

        const issuedAt = deps.now();
        const date = utcDateKey(issuedAt);
        const expiresAt = new Date(
            issuedAt.getTime() + deps.roundTtlSeconds * 1000
        );
        const roundId = randomUUID();
        const todaysPassage = dailyPassage(date, deps.dailySeedSecret);

        let passage = todaysPassage;
        if (mode === "practice") {
            // Practice must never hand out today's ranked passage.
            do {
                passage = generatePassage(randomInt(0, 2 ** 32 - 1));
            } while (passage === todaysPassage);
        }

        const roundKey = deps.keys.round(roundId);
        await deps.redis.hSet(roundKey, {
            playerId: req.playerId,
            mode,
            date,
            passage,
            issuedAt: issuedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            status: "ISSUED",
        });
        await deps.redis.expire(
            roundKey,
            deps.roundTtlSeconds + ROUND_CLEANUP_GRACE_SECONDS
        );

        if (mode === "ranked") {
            // The atomic claim. Only one request per player per day can win this.
            const claimed = await deps.redis.set(
                deps.keys.attempt(date, req.playerId),
                roundId,
                { NX: true, EX: ATTEMPT_KEY_TTL_SECONDS }
            );
            if (claimed === null) {
                await deps.redis.del(roundKey);
                res.status(409).json({ error: "already_attempted" });
                return;
            }
        }

        res.status(201).json({
            roundId,
            mode,
            date,
            passage,
            expiresAt: expiresAt.toISOString(),
        });
    });

    return router;
}