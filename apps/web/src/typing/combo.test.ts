import { describe, expect, it } from "vitest";
import { comboMeterPercent, comboTier } from "./combo.ts";

describe("comboTier", () => {
  it("has no name below 10", () => {
    expect(comboTier(0)).toBeNull();
    expect(comboTier(9)).toBeNull();
  });

  it("names each tier from its first value", () => {
    expect(comboTier(10)).toBe("steady");
    expect(comboTier(24)).toBe("steady");
    expect(comboTier(25)).toBe("flowing");
    expect(comboTier(49)).toBe("flowing");
    expect(comboTier(50)).toBe("inked");
  });
});

describe("comboMeterPercent", () => {
  it("matches the design's examples", () => {
    expect(comboMeterPercent(12)).toBe(24);
    expect(comboMeterPercent(41)).toBe(82);
  });

  it("stops at full", () => {
    expect(comboMeterPercent(50)).toBe(100);
    expect(comboMeterPercent(180)).toBe(100);
  });
});