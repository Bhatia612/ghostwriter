import { describe, it, expect } from "vitest";
import { fnv1a, mulberry32 } from "./prng.js";

describe("fnv1a", () => {
  // Official FNV-1a 32-bit test vectors.
  it("matches the published test vectors", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });

  it("always returns an unsigned 32-bit integer", () => {
    for (const s of ["", "a", "2026-10-11", "x".repeat(1000)]) {
      const h = fnv1a(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});

describe("mulberry32", () => {
  // Golden values: if these change, every past daily passage changes too.
  it("produces a fixed sequence for a fixed seed", () => {
    const rand = mulberry32(42);
    expect(rand()).toBe(0.6011037519201636);
    expect(rand()).toBe(0.44829055899754167);
    expect(rand()).toBe(0.8524657934904099);
  });

  it("produces the same sequence from two generators with the same seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("stays in [0, 1) and averages near 0.5", () => {
    const rand = mulberry32(7);
    let sum = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const x = rand();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
  });
});