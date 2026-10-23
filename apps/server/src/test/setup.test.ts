import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  deleteKeysWithPrefix,
  keysWithPrefix,
  redis,
  testPrefix,
  useTestRedis,
} from "./setup.js";

// Stands in for real data (StepWise, or live Ghostwriter rounds) that
// lives in the same Redis database as the tests.
const REAL_KEY = "stepwise:guard:do-not-delete";

describe("test cleanup", () => {
  useTestRedis();

  // Planted before any beforeEach runs, so a hook that wipes the whole
  // database (like flushDb) would delete it before the tests below.
  beforeAll(async () => {
    await redis.set(REAL_KEY, "real data");
  });
  afterAll(async () => {
    if (redis.isOpen) await redis.del(REAL_KEY);
  });

  it("the per-test cleanup hook leaves other apps' keys alone", async () => {
    expect(await redis.get(REAL_KEY)).toBe("real data");
  });

  it("deletes this run's keys and nothing else", async () => {
    await redis.set(`${testPrefix}round:a`, "test");
    await redis.set(`${testPrefix}round:b`, "test");

    await deleteKeysWithPrefix(testPrefix);

    expect(await keysWithPrefix(testPrefix)).toEqual([]);
    expect(await redis.get(REAL_KEY)).toBe("real data");
  });

  it("refuses to delete anything outside the test prefix", async () => {
    await expect(deleteKeysWithPrefix("gw:")).rejects.toThrow(/Refusing/);
    await expect(deleteKeysWithPrefix("")).rejects.toThrow(/Refusing/);
  });
});