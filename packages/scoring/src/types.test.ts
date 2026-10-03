import { describe, it, expect } from "vitest";
import { keystrokeLogSchema, MAX_LOG_EVENTS } from "./types.js";

const ok = (log: unknown) => keystrokeLogSchema.safeParse(log).success;

describe("keystrokeLogSchema", () => {
    it("accepts a valid log with chars and backspaces", () => {
        expect(
            ok([
                { type: "char", char: "h", t: 0 },
                { type: "char", char: "x", t: 120 },
                { type: "backspace", t: 200 },
                { type: "char", char: "i", t: 310 },
            ])
        ).toBe(true);
    });

    it("accepts an empty log", () => {
        expect(ok([])).toBe(true);
    });

    it("allows equal timestamps", () => {
        expect(
            ok([
                { type: "char", char: "a", t: 100 },
                { type: "char", char: "b", t: 100 },
            ])
        ).toBe(true);
    });

    it("rejects timestamps that go backwards", () => {
        expect(
            ok([
                { type: "char", char: "a", t: 200 },
                { type: "char", char: "b", t: 100 },
            ])
        ).toBe(false);
    });

    it("rejects multi-character input", () => {
        expect(ok([{ type: "char", char: "ab", t: 0 }])).toBe(false);
    });

    it("rejects non-ASCII characters", () => {
        expect(ok([{ type: "char", char: "é", t: 0 }])).toBe(false);
    });

    it("rejects negative and fractional timestamps", () => {
        expect(ok([{ type: "char", char: "a", t: -1 }])).toBe(false);
        expect(ok([{ type: "char", char: "a", t: 1.5 }])).toBe(false);
    });

    it("rejects unknown event types", () => {
        expect(ok([{ type: "paste", text: "hello", t: 0 }])).toBe(false);
    });

    it("rejects logs over the size cap", () => {
        const log = Array.from({ length: MAX_LOG_EVENTS + 1 }, (_, i) => ({
            type: "char",
            char: "a",
            t: i,
        }));
        expect(ok(log)).toBe(false);
    });
});