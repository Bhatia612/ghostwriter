import { describe, it, expect } from "vitest";
import { CHARS_PER_WORD } from "./index.js";

describe("scoring package", () => {
    it("uses the standard 5 characters per word", () => {
        expect(CHARS_PER_WORD).toBe(5);
    });
});