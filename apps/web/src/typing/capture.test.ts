import { describe, expect, it } from "vitest";
import { MAX_LOG_EVENTS, keystrokeLogSchema } from "@ghostwriter/scoring";
import { createRecorder, toEvent, type KeyInput } from "./capture.ts";

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  ...extra,
});

// A fake clock the test controls.
function clock(start = 1000) {
  let time = start;
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
    set: (ms: number) => {
      time = ms;
    },
  };
}

describe("toEvent", () => {
  it("records letters, digits, punctuation and space", () => {
    for (const k of ["a", "Z", "7", ".", "!", " "]) {
      expect(toEvent(key(k), 5)).toEqual({ type: "char", char: k, t: 5 });
    }
  });

  it("records Backspace", () => {
    expect(toEvent(key("Backspace"), 5)).toEqual({ type: "backspace", t: 5 });
  });

  it("ignores non-typing keys", () => {
    for (const k of ["Shift", "Enter", "Tab", "Escape", "ArrowLeft", "CapsLock", "Delete", "F5"]) {
      expect(toEvent(key(k), 5)).toBeNull();
    }
  });

  it("ignores shortcuts made with Ctrl, Cmd or Alt", () => {
    expect(toEvent(key("a", { ctrlKey: true }), 5)).toBeNull();
    expect(toEvent(key("Backspace", { ctrlKey: true }), 5)).toBeNull();
    expect(toEvent(key("v", { metaKey: true }), 5)).toBeNull();
    expect(toEvent(key("x", { altKey: true }), 5)).toBeNull();
  });

  it("ignores characters the server would reject", () => {
    for (const k of ["é", "ñ", "😀", "€"]) {
      expect(toEvent(key(k), 5)).toBeNull();
    }
  });

  it("ignores keys pressed mid-composition", () => {
    expect(toEvent(key("e", { isComposing: true }), 5)).toBeNull();
  });
});

describe("createRecorder", () => {
  it("timestamps events in whole ms since the passage appeared", () => {
    const c = clock();
    const rec = createRecorder(c.now);
    c.advance(120.4);
    rec.record(key("h"));
    c.advance(99.8);
    rec.record(key("i"));
    expect(rec.snapshot()).toEqual([
      { type: "char", char: "h", t: 120 },
      { type: "char", char: "i", t: 220 },
    ]);
  });

  it("never lets timestamps go backwards, even if the clock does", () => {
    const c = clock();
    const rec = createRecorder(c.now);
    c.set(1500);
    rec.record(key("a"));
    c.set(1400);
    rec.record(key("b"));
    const [a, b] = rec.snapshot();
    expect(b!.t).toBeGreaterThanOrEqual(a!.t);
  });

  it("does not record ignored keys", () => {
    const rec = createRecorder(clock().now);
    rec.record(key("Shift"));
    rec.record(key("é"));
    rec.record(key("a", { ctrlKey: true }));
    expect(rec.snapshot()).toEqual([]);
  });

  it("stops recording at the server's size cap", () => {
    const rec = createRecorder(clock().now);
    for (let i = 0; i < MAX_LOG_EVENTS + 50; i++) rec.record(key("a"));
    expect(rec.snapshot()).toHaveLength(MAX_LOG_EVENTS);
  });

  it("returns a copy, so callers can't change the recorded log", () => {
    const rec = createRecorder(clock().now);
    rec.record(key("a"));
    rec.snapshot().push({ type: "backspace", t: 0 });
    expect(rec.snapshot()).toHaveLength(1);
  });

  it("always produces a log the server will accept, whatever is pressed", () => {
    const keys = ["a", "B", " ", "Backspace", "Shift", "é", "Enter", "😀", "9", "Tab", ";"];
    const c = clock();
    const rec = createRecorder(c.now);
    // Deterministic pseudo-random key mashing with a jittery clock.
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 2000; i++) {
      c.advance(rand() * 40 - 5);
      rec.record(key(keys[Math.floor(rand() * keys.length)]!, { ctrlKey: rand() < 0.05 }));
    }
    expect(keystrokeLogSchema.safeParse(rec.snapshot()).success).toBe(true);
  });
});