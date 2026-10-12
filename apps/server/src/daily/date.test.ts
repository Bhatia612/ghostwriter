import { describe, it, expect } from "vitest";
import { utcDateKey } from "./date.js";

describe("utcDateKey", () => {
  it("keeps the last millisecond of a day on that day", () => {
    expect(utcDateKey(new Date("2026-10-03T23:59:59.999Z"))).toBe("2026-10-03");
  });

  it("rolls over exactly at UTC midnight", () => {
    expect(utcDateKey(new Date("2026-10-04T00:00:00.000Z"))).toBe("2026-10-04");
  });

  it("uses UTC, not the local time of the timestamp", () => {
    // 9pm in New York on Oct 3 is already Oct 4 in UTC.
    expect(utcDateKey(new Date("2026-10-03T21:00:00-04:00"))).toBe("2026-10-04");
  });
});