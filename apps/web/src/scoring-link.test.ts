import { describe, expect, it } from "vitest";
import { score } from "@ghostwriter/scoring";

describe("@ghostwriter/scoring in the web app", () => {
    it("scores a log exactly as the server would", () => {
        const result = score("cat", [
            { type: "char", char: "c", t: 0 },
            { type: "char", char: "a", t: 100 },
            { type: "char", char: "t", t: 200 },
        ]);
        expect(result.finalScore).toBe(270);
    });
});