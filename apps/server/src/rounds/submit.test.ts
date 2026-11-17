import { describe, it, expect } from "vitest";
import request from "supertest";
import { score, type KeystrokeLog } from "@ghostwriter/scoring";
import { createApp } from "../app.js";
import { PLAYER_COOKIE } from "../player/player.js";
import { redis, testConfig, testKeys, useTestRedis } from "../test/setup.js";

const PLAYER_A = "11111111-1111-4111-8111-111111111111";
const PLAYER_B = "22222222-2222-4222-8222-222222222222";
const cookie = (id: string) => `${PLAYER_COOKIE}=${id}`;

const ISSUED_AT = "2026-10-11T15:00:00.000Z";
const at = (offsetMs: number) =>
  new Date(Date.parse(ISSUED_AT) + offsetMs).toISOString();

function appAt(iso: string) {
  return createApp({ config: testConfig, redis, now: () => new Date(iso) });
}

// Types the passage perfectly, one key every `intervalMs`.
function perfectLog(passage: string, intervalMs = 100): KeystrokeLog {
  return [...passage].map((char, i) => ({ type: "char", char, t: i * intervalMs }));
}

async function issue(mode: "ranked" | "practice", player = PLAYER_A, when = ISSUED_AT) {
  const res = await request(appAt(when))
    .post("/rounds")
    .set("Cookie", cookie(player))
    .send({ mode });
  expect(res.status).toBe(201);
  return res.body as { roundId: string; passage: string; date: string };
}

function submit(roundId: string, body: unknown, when: string, player = PLAYER_A) {
  return request(appAt(when))
    .post(`/rounds/${roundId}/submit`)
    .set("Cookie", cookie(player))
    .send(body as object);
}

describe("POST /rounds/:roundId/submit", () => {
  useTestRedis();

  describe("scoring", () => {
    it("scores a ranked run on the server and marks it submitted", async () => {
      const round = await issue("ranked");
      const log = perfectLog(round.passage);

      const res = await submit(round.roundId, { log }, at(60_000));

      expect(res.status).toBe(200);
      expect(res.body.replayed).toBe(false);
      expect(res.body.mode).toBe("ranked");
      expect(res.body.result).toEqual(score(round.passage, log));
      expect(res.body.result.completed).toBe(true);

      const stored = await redis.hGetAll(testKeys.round(round.roundId));
      expect(stored.status).toBe("SUBMITTED");
      expect(stored.submittedAt).toBe(at(60_000));
    });

    it("ignores any score the client tries to send", async () => {
      const round = await issue("ranked");
      const log = perfectLog(round.passage);

      const res = await submit(
        round.roundId,
        { log, finalScore: 99999, wpm: 500, result: { finalScore: 99999 } },
        at(60_000)
      );

      expect(res.body.result).toEqual(score(round.passage, log));
    });

    it("accepts an unfinished run with a final score of 0", async () => {
      const round = await issue("ranked");
      const log = perfectLog(round.passage.slice(0, 20));

      const res = await submit(round.roundId, { log }, at(60_000));

      expect(res.status).toBe(200);
      expect(res.body.result.completed).toBe(false);
      expect(res.body.result.finalScore).toBe(0);
    });

    it("submits practice rounds without needing the ranked attempt", async () => {
      const round = await issue("practice");
      const res = await submit(round.roundId, { log: perfectLog(round.passage) }, at(60_000));
      expect(res.status).toBe(200);
      expect(res.body.mode).toBe("practice");
    });
  });

  describe("validation", () => {
    it("rejects a log that breaks the contract", async () => {
      const round = await issue("practice");
      const log = [
        { type: "char", char: "a", t: 500 },
        { type: "char", char: "b", t: 100 },
      ];
      const res = await submit(round.roundId, { log }, at(60_000));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "invalid_log" });
    });

    it("rejects a body without a log", async () => {
      const round = await issue("practice");
      const res = await submit(round.roundId, {}, at(60_000));
      expect(res.status).toBe(400);
    });

    it("returns 404 for an unknown round", async () => {
      const res = await submit(
        "33333333-3333-4333-8333-333333333333",
        { log: [] },
        at(60_000)
      );
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "round_not_found" });
    });

    it("returns 404 for a malformed round id", async () => {
      const res = await submit("not-a-uuid*", { log: [] }, at(60_000));
      expect(res.status).toBe(404);
    });

    it("hides another player's round behind the same 404", async () => {
      const round = await issue("ranked", PLAYER_A);
      const res = await submit(
        round.roundId,
        { log: perfectLog(round.passage) },
        at(60_000),
        PLAYER_B
      );
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "round_not_found" });
    });
  });

  describe("timing", () => {
    it("accepts a submit at the exact expiry moment", async () => {
      const round = await issue("practice");
      const res = await submit(round.roundId, { log: perfectLog(round.passage) }, at(600_000));
      expect(res.status).toBe(200);
    });

    it("rejects a submit one millisecond after expiry and leaves the round unsubmitted", async () => {
      const round = await issue("practice");
      const res = await submit(round.roundId, { log: perfectLog(round.passage) }, at(600_001));
      expect(res.status).toBe(410);
      expect(res.body).toEqual({ error: "round_expired" });
      expect((await redis.hGetAll(testKeys.round(round.roundId))).status).toBe("ISSUED");
    });

    it("rejects a log that claims more time than really passed", async () => {
      const round = await issue("practice");
      // Log says typing took ~18 seconds, but only 5 seconds passed on the server.
      const res = await submit(round.roundId, { log: perfectLog(round.passage) }, at(5_000));
      expect(res.status).toBe(422);
      expect(res.body).toEqual({ error: "implausible_timing" });
    });

    it("allows small clock drift within the tolerance", async () => {
      const round = await issue("practice");
      const log = perfectLog(round.passage);
      const logDuration = log.at(-1)!.t;
      const res = await submit(round.roundId, { log }, at(logDuration - 1_500));
      expect(res.status).toBe(200);
    });

    it("keeps a round issued before UTC midnight on its original day", async () => {
      const round = await issue("ranked", PLAYER_A, "2026-10-11T23:59:00.000Z");
      const res = await submit(
        round.roundId,
        { log: perfectLog(round.passage) },
        "2026-10-12T00:00:30.000Z"
      );
      expect(res.status).toBe(200);
      expect(res.body.date).toBe("2026-10-11");
    });
  });

  describe("ranked attempt binding", () => {
    it("rejects a ranked round that does not own today's attempt", async () => {
      const round = await issue("ranked");
      // Simulates an orphan: the attempt points at some other round.
      await redis.set(
        testKeys.attempt(round.date, PLAYER_A),
        "44444444-4444-4444-8444-444444444444"
      );
      const res = await submit(round.roundId, { log: perfectLog(round.passage) }, at(60_000));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "attempt_mismatch" });
    });
  });

  describe("idempotency", () => {
    it("returns the original result when the same submit is retried", async () => {
      const round = await issue("ranked");
      const log = perfectLog(round.passage);

      const first = await submit(round.roundId, { log }, at(60_000));
      const retry = await submit(round.roundId, { log }, at(61_000));

      expect(retry.status).toBe(200);
      expect(retry.body.replayed).toBe(true);
      expect(retry.body.result).toEqual(first.body.result);
    });

    it("keeps the first result when a different log is submitted later", async () => {
      const round = await issue("ranked");
      const slow = perfectLog(round.passage, 200);
      const fast = perfectLog(round.passage, 50);

      const first = await submit(round.roundId, { log: slow }, at(60_000));
      const second = await submit(round.roundId, { log: fast }, at(61_000));

      expect(second.body.replayed).toBe(true);
      expect(second.body.result).toEqual(first.body.result);
      expect(second.body.result).toEqual(score(round.passage, slow));
    });

    it("lets exactly one of many simultaneous submits win", async () => {
      const round = await issue("ranked");
      const log = perfectLog(round.passage);

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => submit(round.roundId, { log }, at(60_000)))
      );

      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(responses.filter((r) => r.body.replayed === false)).toHaveLength(1);
      const results = responses.map((r) => JSON.stringify(r.body.result));
      expect(new Set(results).size).toBe(1);
    });
  });
});