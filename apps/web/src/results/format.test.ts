import { describe, expect, it } from "vitest";
import { formatAccuracy, formatDuration, formatScore, wordsCompleted } from "./format.ts";

describe("formatScore", () => {
    it("rounds and adds thousands separators", () => {
        expect(formatScore(1284.4)).toBe("1,284");
        expect(formatScore(0)).toBe("0");
    });
});

describe("formatDuration", () => {
    it("shows minutes and seconds to a tenth", () => {
        expect(formatDuration(27_830)).toBe("0:27.8");
        expect(formatDuration(3_000)).toBe("0:03.0");
        expect(formatDuration(75_400)).toBe("1:15.4");
    });

    it("rolls over cleanly at a full minute", () => {
        expect(formatDuration(59_960)).toBe("1:00.0");
    });
});

describe("formatAccuracy", () => {
    it("shows a whole percentage", () => {
        expect(formatAccuracy(0.97)).toBe("97%");
        expect(formatAccuracy(1)).toBe("100%");
    });
});

describe("wordsCompleted", () => {
    const passage = "the cat sat";

    it("counts only words typed all the way through", () => {
        expect(wordsCompleted(passage, 0)).toBe(0);
        expect(wordsCompleted(passage, 2)).toBe(0);
        expect(wordsCompleted(passage, 3)).toBe(1);
        expect(wordsCompleted(passage, 6)).toBe(1);
        expect(wordsCompleted(passage, 7)).toBe(2);
    });

    it("counts every word when the passage is done", () => {
        expect(wordsCompleted(passage, passage.length)).toBe(3);
    });
});