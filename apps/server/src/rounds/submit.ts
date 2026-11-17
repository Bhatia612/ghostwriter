import type { RedisClientType } from "redis";
import { keystrokeLogSchema, score, type ScoreResult } from "@ghostwriter/scoring";
import type { RequestHandler } from "express";
import { isUuid } from "../lib/uuid.js";
import type { Keys } from "./keys.js";


export const CLOCK_TOLERANCE_MS = 2000;


const TRANSITION_SCRIPT = `
if redis.call('HGET', KEYS[1], 'status') ~= 'ISSUED' then
  return 0
end
redis.call('HSET', KEYS[1], 'status', 'SUBMITTED', 'result', ARGV[1], 'submittedAt', ARGV[2])
return 1
`;

export interface SubmitDeps {
    redis: RedisClientType;
    keys: Keys;
    now: () => Date;
}

export function submitRound(deps: SubmitDeps): RequestHandler<{ roundId: string }> {
    return async (req, res) => {
        const { roundId } = req.params;

        // Validate before it goes anywhere near a Redis key name.
        if (!isUuid(roundId)) {
            res.status(404).json({ error: "round_not_found" });
            return;
        }

        const parsedLog = keystrokeLogSchema.safeParse(req.body?.log);
        if (!parsedLog.success) {
            res.status(400).json({ error: "invalid_log" });
            return;
        }
        const log = parsedLog.data;

        const roundKey = deps.keys.round(roundId);
        const round = await deps.redis.hGetAll(roundKey);

        // Someone else's round looks exactly like a missing one,
        // so the endpoint can't be used to probe which IDs exist.
        if (!round.status || round.playerId !== req.playerId) {
            res.status(404).json({ error: "round_not_found" });
            return;
        }

        if (round.status === "SUBMITTED") {
            return sendResult(res, roundId, round, true);
        }

        const now = deps.now();
        if (now.getTime() > Date.parse(round.expiresAt!)) {
            res.status(410).json({ error: "round_expired" });
            return;
        }

        if (round.mode === "ranked") {
            // The round only counts if it is the one that won today's attempt claim.
            const owner = await deps.redis.get(
                deps.keys.attempt(round.date!, round.playerId!)
            );
            if (owner !== roundId) {
                res.status(409).json({ error: "attempt_mismatch" });
                return;
            }
        }

        const serverElapsedMs = now.getTime() - Date.parse(round.issuedAt!);
        const logDurationMs = log.at(-1)?.t ?? 0;
        if (logDurationMs > serverElapsedMs + CLOCK_TOLERANCE_MS) {
            res.status(422).json({ error: "implausible_timing" });
            return;
        }

        const result = score(round.passage!, log);

        const won = await deps.redis.eval(TRANSITION_SCRIPT, {
            keys: [roundKey],
            arguments: [JSON.stringify(result), now.toISOString()],
        });

        if (won === 1) {
            return sendResult(res, roundId, { ...round, result: JSON.stringify(result) }, false);
        }

        // Lost a race with a concurrent submit. Return whatever that one stored.
        const latest = await deps.redis.hGetAll(roundKey);
        if (latest.status === "SUBMITTED") {
            return sendResult(res, roundId, latest, true);
        }
        res.status(404).json({ error: "round_not_found" });
    };
}

function sendResult(
    res: Parameters<RequestHandler>[1],
    roundId: string,
    round: Record<string, string>,
    replayed: boolean
) {
    const result = JSON.parse(round.result!) as ScoreResult;
    res.status(200).json({
        roundId,
        mode: round.mode,
        date: round.date,
        result,
        replayed,
    });
}