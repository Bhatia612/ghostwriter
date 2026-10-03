import { describe, it, expect } from "vitest";
import { replay } from "./replay.js";
import type { KeystrokeEvent, KeystrokeLog } from "./types.js";

const BS = "BS";

// log("c", "a", BS) -> events 100ms apart, BS means backspace
function log(...keys: string[]): KeystrokeLog {
    return keys.map(
        (k, i): KeystrokeEvent =>
            k === BS
                ? { type: "backspace", t: i * 100 }
                : { type: "char", char: k, t: i * 100 }
    );
}

describe("replay", () => {
    it("handles an empty log", () => {
        expect(replay("cat", [])).toEqual({
            typed: "",
            combo: 0,
            maxCombo: 0,
            correctKeystrokes: 0,
            totalKeystrokes: 0,
            completed: false,
            startT: null,
            endT: null,
        });
    });

    it("scores a perfect run", () => {
        const s = replay("cat", log("c", "a", "t"));
        expect(s.completed).toBe(true);
        expect(s.maxCombo).toBe(3);
        expect(s.correctKeystrokes).toBe(3);
        expect(s.totalKeystrokes).toBe(3);
        expect(s.startT).toBe(0);
        expect(s.endT).toBe(200);
    });

    it("resets combo on a mistake and never restores it", () => {
        const s = replay("cat", log("c", "x", BS, "a", "t"));
        expect(s.completed).toBe(true);
        expect(s.maxCombo).toBe(2);
        expect(s.correctKeystrokes).toBe(3);
        expect(s.totalKeystrokes).toBe(4);
        expect(s.endT).toBe(400);
    });

    it("treats a matching letter after an uncorrected error as incorrect", () => {
        const s = replay("cat", log("c", "x", "t"));
        expect(s.typed).toBe("cxt");
        expect(s.completed).toBe(false);
        expect(s.correctKeystrokes).toBe(1);
        expect(s.totalKeystrokes).toBe(3);
        expect(s.combo).toBe(0);
        expect(s.endT).toBeNull();
    });

    it("breaks the combo when backspacing a correct character", () => {
        const s = replay("cat", log("c", "a", BS, "a", "t"));
        expect(s.completed).toBe(true);
        expect(s.maxCombo).toBe(2);
        expect(s.correctKeystrokes).toBe(4);
        expect(s.totalKeystrokes).toBe(4);
    });

    it("ignores backspace on an empty buffer", () => {
        const s = replay("cat", log(BS, "c", "a", "t"));
        expect(s.completed).toBe(true);
        expect(s.maxCombo).toBe(3);
        expect(s.startT).toBe(100);
    });

    it("ignores events after completion", () => {
        const s = replay("cat", log("c", "a", "t", "x"));
        expect(s.typed).toBe("cat");
        expect(s.totalKeystrokes).toBe(3);
        expect(s.endT).toBe(200);
    });

    it("ignores chars once the buffer is full of errors", () => {
        const s = replay("ab", log("a", "x", "y"));
        expect(s.typed).toBe("ax");
        expect(s.totalKeystrokes).toBe(2);
        expect(s.correctKeystrokes).toBe(1);
        expect(s.completed).toBe(false);
    });
});