import { describe, it, expect } from "vitest";
import {
  dailyPassage,
  dailySeed,
  generatePassage,
  PASSAGE_WORD_COUNT,
} from "./passage.js";
import { WORDS } from "./words.js";

const SECRET = "test-secret";

describe("dailyPassage", () => {
  it("returns the same passage for the same date and secret", () => {
    expect(dailyPassage("2026-10-11", SECRET)).toBe(
      dailyPassage("2026-10-11", SECRET)
    );
  });

  it("returns a different passage on a different date", () => {
    expect(dailyPassage("2026-10-11", SECRET)).not.toBe(
      dailyPassage("2026-10-12", SECRET)
    );
  });

  it("returns a different passage with a different secret", () => {
    expect(dailyPassage("2026-10-11", SECRET)).not.toBe(
      dailyPassage("2026-10-11", "another-secret")
    );
  });

  it("refuses to run without a secret", () => {
    expect(() => dailySeed("2026-10-11", "")).toThrow();
  });

  it("produces passages that fit the scoring contract for a whole year", () => {
    const start = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 365; d++) {
      const key = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
      const p = dailyPassage(key, SECRET);
      expect(p).toMatch(/^[\x20-\x7E]+$/);
      expect(p).not.toMatch(/^ | $|  /);
      expect(p.split(" ")).toHaveLength(PASSAGE_WORD_COUNT);
    }
  });
});

describe("generatePassage", () => {
  it("only uses words from the list", () => {
    const words = generatePassage(99).split(" ");
    for (const w of words) expect(WORDS).toContain(w);
  });

  it("never repeats the same word back to back", () => {
    for (let seed = 0; seed < 500; seed++) {
      const words = generatePassage(seed).split(" ");
      for (let i = 1; i < words.length; i++) {
        expect(words[i]).not.toBe(words[i - 1]);
      }
    }
  });

  it("still works with a single-word list", () => {
    expect(generatePassage(1, ["solo"], 3)).toBe("solo solo solo");
  });

  it("rejects an empty word list", () => {
    expect(() => generatePassage(1, [])).toThrow();
  });
});