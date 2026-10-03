import { describe, it, expect } from "vitest";
import { score } from "./score.js";
import type { KeystrokeEvent, KeystrokeLog } from "./types.js";

const BS = "BS";

function log(...keys: string[]): KeystrokeLog {
    return keys.map(
        (k, i): KeystrokeEvent =>
            k === BS
                ? { type: "backspace", t: i * 100 }
                : { type: "char", char: k, t: i * 100 }
    );
}

// "hex" + BS + "llo" -> ["h","e","x",BS,"l","l","o"]
function splitKeys(s: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
        if (s.startsWith(BS, i)) {
            out.push(BS);
            i += BS.length - 1;
        } else out.push(s[i]!);
    }
    return out;
}

describe("score", () => {
    it("scores a perfect run with the full combo bonus", () => {
        // 3 chars in 200ms = 0.6 words in 1/300 min = 180 wpm
        // 180 * 1.0 accuracy * 1.5 bonus = 270
        const r = score("cat", log("c", "a", "t"));
        expect(r.wpm).toBe(180);
        expect(r.accuracy).toBe(1);
        expect(r.finalScore).toBe(270);
        expect(r.durationMs).toBe(200);
        expect(r.completed).toBe(true);
    });

    it("penalizes a mistake through accuracy, time and combo", () => {
        // 3 chars in 400ms = 90 wpm, accuracy 3/4, bonus 1 + 0.5 * 2/3
        // 90 * 0.75 * 1.3333 = 90
        const r = score("cat", log("c", "x", BS, "a", "t"));
        expect(r.wpm).toBe(90);
        expect(r.accuracy).toBe(0.75);
        expect(r.maxCombo).toBe(2);
        expect(r.finalScore).toBe(90);
    });

    it("gives an incomplete run a final score of 0 but still reports wpm", () => {
        // only "c" is a correct prefix: 1 char in 200ms = 60 wpm
        const r = score("cat", log("c", "x", "t"));
        expect(r.completed).toBe(false);
        expect(r.correctChars).toBe(1);
        expect(r.wpm).toBe(60);
        expect(r.finalScore).toBe(0);
    });

    it("returns zeros for an empty log instead of NaN or Infinity", () => {
        expect(score("cat", [])).toEqual({
            wpm: 0,
            accuracy: 0,
            maxCombo: 0,
            finalScore: 0,
            correctChars: 0,
            totalKeystrokes: 0,
            durationMs: 0,
            completed: false,
        });
    });

    it("returns 0 wpm for a zero-duration run instead of Infinity", () => {
        const r = score("a", [{ type: "char", char: "a", t: 500 }]);
        expect(r.completed).toBe(true);
        expect(r.durationMs).toBe(0);
        expect(r.wpm).toBe(0);
        expect(Number.isFinite(r.finalScore)).toBe(true);
    });

    it("ignores time spent before the first keystroke", () => {
        const shifted: KeystrokeLog = log("c", "a", "t").map((e) => ({
            ...e,
            t: e.t + 5000,
        }));
        expect(score("cat", shifted).wpm).toBe(180);
    });

    it("ranks a clean run above a sloppy run with higher wpm", () => {
        const passage = "hello world";
        const clean = log(..."hello world".split(""));
        // sloppy: keystrokes 2x faster (higher wpm) but 4 corrected mistakes
        const sloppyKeys = "hex" + BS + "llo wqr" + BS + BS + "orx" + BS + "ld";
        const sloppy: KeystrokeLog = log(...splitKeys(sloppyKeys)).map((e) => ({
            ...e,
            t: Math.round(e.t / 2),
        }));
        const a = score(passage, clean);
        const b = score(passage, sloppy);
        expect(b.completed).toBe(true);
        expect(b.wpm).toBeGreaterThan(a.wpm);
        expect(a.finalScore).toBeGreaterThan(b.finalScore);
    });

    it("is deterministic: same input, same output", () => {
        const l = log("c", "x", BS, "a", "t");
        expect(score("cat", l)).toEqual(score("cat", l));
    });
});