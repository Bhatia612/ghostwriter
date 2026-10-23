import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { dailyPassage } from "../daily/passage.js";
import { PLAYER_COOKIE } from "../player/player.js";
import {
    keysWithPrefix,
    redis,
    testConfig,
    testKeys,
    testPrefix,
    useTestRedis,
} from "../test/setup.js";

const PLAYER_A = "11111111-1111-4111-8111-111111111111";
const PLAYER_B = "22222222-2222-4222-8222-222222222222";
const cookie = (id: string) => `${PLAYER_COOKIE}=${id}`;

function appAt(iso: string) {
    return createApp({ config: testConfig, redis, now: () => new Date(iso) });
}

describe("POST /rounds", () => {
    useTestRedis();
    const app = appAt("2026-10-11T15:00:00.000Z");

    describe("player identity", () => {
        it("issues an httpOnly player cookie on the first request", async () => {
            const res = await request(app).post("/rounds").send({ mode: "practice" });
            expect(res.status).toBe(201);
            const setCookie = String(res.headers["set-cookie"]);
            expect(setCookie).toMatch(new RegExp(`^${PLAYER_COOKIE}=`));
            expect(setCookie).toMatch(/HttpOnly/);
        });

        it("keeps an existing valid player cookie", async () => {
            const res = await request(app)
                .post("/rounds")
                .set("Cookie", cookie(PLAYER_A))
                .send({ mode: "practice" });
            expect(res.headers["set-cookie"]).toBeUndefined();
            const round = await redis.hGetAll(testKeys.round(res.body.roundId));
            expect(round.playerId).toBe(PLAYER_A);
        });

        it("replaces a malformed player cookie instead of trusting it", async () => {
            const res = await request(app)
                .post("/rounds")
                .set("Cookie", cookie("evil:key*injection"))
                .send({ mode: "practice" });
            expect(res.headers["set-cookie"]).toBeDefined();
            const round = await redis.hGetAll(testKeys.round(res.body.roundId));
            expect(round.playerId).not.toBe("evil:key*injection");
        });
    });

    describe("validation", () => {
        it("rejects an unknown mode", async () => {
            const res = await request(app).post("/rounds").send({ mode: "cheat" });
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: "invalid_body" });
        });

        it("rejects a missing body", async () => {
            const res = await request(app).post("/rounds");
            expect(res.status).toBe(400);
        });
    });

    describe("ranked", () => {
        it("issues today's daily passage and stores the round", async () => {
            const res = await request(app)
                .post("/rounds")
                .set("Cookie", cookie(PLAYER_A))
                .send({ mode: "ranked" });

            expect(res.status).toBe(201);
            expect(res.body.mode).toBe("ranked");
            expect(res.body.date).toBe("2026-10-11");
            expect(res.body.passage).toBe(dailyPassage("2026-10-11", "test-secret"));
            expect(res.body.expiresAt).toBe("2026-10-11T15:10:00.000Z");

            const round = await redis.hGetAll(testKeys.round(res.body.roundId));
            expect(round).toMatchObject({
                playerId: PLAYER_A,
                mode: "ranked",
                date: "2026-10-11",
                status: "ISSUED",
                passage: res.body.passage,
            });
            expect(await redis.ttl(testKeys.round(res.body.roundId))).toBeGreaterThan(600);
            expect(await redis.get(testKeys.attempt("2026-10-11", PLAYER_A))).toBe(
                res.body.roundId
            );
        });

        it("refuses a second ranked round for the same player and day", async () => {
            await request(app).post("/rounds").set("Cookie", cookie(PLAYER_A)).send({ mode: "ranked" });
            const res = await request(app)
                .post("/rounds")
                .set("Cookie", cookie(PLAYER_A))
                .send({ mode: "ranked" });
            expect(res.status).toBe(409);
            expect(res.body).toEqual({ error: "already_attempted" });
        });

        it("leaves no orphan round behind when the claim fails", async () => {
            await request(app).post("/rounds").set("Cookie", cookie(PLAYER_A)).send({ mode: "ranked" });
            await request(app).post("/rounds").set("Cookie", cookie(PLAYER_A)).send({ mode: "ranked" });
            expect(await keysWithPrefix(`${testPrefix}round:`)).toHaveLength(1);
        });

        it("lets a different player take their own ranked attempt", async () => {
            await request(app).post("/rounds").set("Cookie", cookie(PLAYER_A)).send({ mode: "ranked" });
            const res = await request(app)
                .post("/rounds")
                .set("Cookie", cookie(PLAYER_B))
                .send({ mode: "ranked" });
            expect(res.status).toBe(201);
        });

        it("allows exactly one of many simultaneous ranked requests", async () => {
            const responses = await Promise.all(
                Array.from({ length: 10 }, () =>
                    request(app)
                        .post("/rounds")
                        .set("Cookie", cookie(PLAYER_A))
                        .send({ mode: "ranked" })
                )
            );
            const statuses = responses.map((r) => r.status).sort();
            expect(statuses.filter((s) => s === 201)).toHaveLength(1);
            expect(statuses.filter((s) => s === 409)).toHaveLength(9);
        });

        it("gives the player a new attempt once the UTC day rolls over", async () => {
            const beforeMidnight = appAt("2026-10-11T23:59:59.999Z");
            const afterMidnight = appAt("2026-10-12T00:00:00.000Z");

            const a = await request(beforeMidnight)
                .post("/rounds").set("Cookie", cookie(PLAYER_A)).send({ mode: "ranked" });
            const b = await request(afterMidnight)
                .post("/rounds").set("Cookie", cookie(PLAYER_A)).send({ mode: "ranked" });

            expect(a.status).toBe(201);
            expect(a.body.date).toBe("2026-10-11");
            expect(b.status).toBe(201);
            expect(b.body.date).toBe("2026-10-12");
            expect(b.body.passage).not.toBe(a.body.passage);
        });
    });

    describe("practice", () => {
        it("never hands out today's ranked passage", async () => {
            const today = dailyPassage("2026-10-11", "test-secret");
            for (let i = 0; i < 20; i++) {
                const res = await request(app)
                    .post("/rounds")
                    .set("Cookie", cookie(PLAYER_A))
                    .send({ mode: "practice" });
                expect(res.status).toBe(201);
                expect(res.body.passage).not.toBe(today);
            }
        });

        it("is unlimited and does not use up the ranked attempt", async () => {
            for (let i = 0; i < 3; i++) {
                const res = await request(app)
                    .post("/rounds").set("Cookie", cookie(PLAYER_A)).send({ mode: "practice" });
                expect(res.status).toBe(201);
            }
            const ranked = await request(app)
                .post("/rounds").set("Cookie", cookie(PLAYER_A)).send({ mode: "ranked" });
            expect(ranked.status).toBe(201);
        });
    });
});