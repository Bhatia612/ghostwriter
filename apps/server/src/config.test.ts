import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

const base = { REDIS_URL: "redis://localhost:6379", DAILY_SEED_SECRET: "s" };

describe("loadConfig", () => {
    it("loads required values and applies defaults", () => {
        const c = loadConfig(base);
        expect(c.redisUrl).toBe("redis://localhost:6379");
        expect(c.port).toBe(3000);
        expect(c.roundTtlSeconds).toBe(600);
        expect(c.cookieSecure).toBe(false);
        expect(c.keyPrefix).toBe("gw:");
    });

    it("refuses to start without REDIS_URL", () => {
        expect(() => loadConfig({ DAILY_SEED_SECRET: "s" })).toThrow(/REDIS_URL/);
    });

    it("refuses to start without DAILY_SEED_SECRET", () => {
        expect(() => loadConfig({ REDIS_URL: "redis://x" })).toThrow(
            /DAILY_SEED_SECRET/
        );
    });

    it("marks cookies secure in production", () => {
        expect(loadConfig({ ...base, NODE_ENV: "production" }).cookieSecure).toBe(true);
    });
});