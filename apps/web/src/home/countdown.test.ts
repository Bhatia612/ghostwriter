import { describe, expect, it } from "vitest";
import { formatCountdown, formatUtcDate, msUntilUtcMidnight } from "./countdown.ts";

describe("msUntilUtcMidnight", () => {
  it("counts down to the next UTC midnight", () => {
    expect(msUntilUtcMidnight(new Date("2026-11-17T23:59:59.000Z"))).toBe(1000);
    expect(msUntilUtcMidnight(new Date("2026-11-17T10:26:08.000Z"))).toBe(48_832_000);
  });

  it("is a full day exactly at midnight", () => {
    expect(msUntilUtcMidnight(new Date("2026-11-18T00:00:00.000Z"))).toBe(86_400_000);
  });

  it("uses UTC, not the local time zone", () => {
    expect(msUntilUtcMidnight(new Date("2026-11-17T20:00:00-05:00"))).toBe(23 * 3_600_000);
  });
});

describe("formatCountdown", () => {
  it("pads hours, minutes and seconds", () => {
    expect(formatCountdown(48_832_000)).toBe("13:33:52");
    expect(formatCountdown(5_000)).toBe("00:00:05");
  });

  it("rounds up, so it never shows zero before the reset", () => {
    expect(formatCountdown(1)).toBe("00:00:01");
  });
});

describe("formatUtcDate", () => {
  it("names the UTC day, even late in the evening in Toronto", () => {
    expect(formatUtcDate(new Date("2026-11-17T21:00:00-05:00"))).toBe("Wednesday, 18 November 2026");
  });
});