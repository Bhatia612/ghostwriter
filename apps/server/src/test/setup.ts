import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { createClient, type RedisClientType } from "redis";
import type { Config } from "../config.js";
import { createKeys } from "../rounds/keys.js";

// Tests may share the real Redis database. That is safe only because they
// never flush it: each run gets its own prefix and deletes only those keys.
const url = process.env.REDIS_TEST_URL ?? process.env.REDIS_URL;
if (!url) {
  throw new Error("Set REDIS_URL (or REDIS_TEST_URL) to run the tests.");
}

export const TEST_PREFIX_ROOT = "gwtest:";
export const testPrefix = `${TEST_PREFIX_ROOT}${randomUUID()}:`;
export const testKeys = createKeys(testPrefix);

export const redis: RedisClientType = createClient({ url });

export const testConfig: Config = {
  port: 0,
  redisUrl: url,
  dailySeedSecret: "test-secret",
  roundTtlSeconds: 600,
  cookieSecure: false,
  keyPrefix: testPrefix,
};

// Deletes keys under one prefix only. Uses SCAN, not KEYS, because KEYS
// blocks the whole Redis server while it walks every key in the database.
export async function deleteKeysWithPrefix(prefix: string): Promise<void> {
  if (!prefix.startsWith(TEST_PREFIX_ROOT)) {
    throw new Error(`Refusing to delete keys outside ${TEST_PREFIX_ROOT}: ${prefix}`);
  }
  for await (const batch of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
    if (batch.length > 0) await redis.del(batch);
  }
}

export async function keysWithPrefix(prefix: string): Promise<string[]> {
  const found: string[] = [];
  for await (const batch of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
    found.push(...batch);
  }
  return found;
}

export function useTestRedis() {
  beforeAll(async () => {
    if (!redis.isOpen) await redis.connect();
  });
  beforeEach(async () => {
    await deleteKeysWithPrefix(testPrefix);
  });
  afterAll(async () => {
    await deleteKeysWithPrefix(testPrefix);
    if (redis.isOpen) await redis.quit();
  });
}