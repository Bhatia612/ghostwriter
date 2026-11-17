import { MAX_LOG_EVENTS, type KeystrokeEvent } from "@ghostwriter/scoring";

export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
}

const PRINTABLE_ASCII = /^[\x20-\x7E]$/;


export function toEvent(input: KeyInput, t: number): KeystrokeEvent | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (input.isComposing) return null;

  if (input.key === "Backspace") return { type: "backspace", t };
  if (PRINTABLE_ASCII.test(input.key)) return { type: "char", char: input.key, t };
  return null;
}

export interface Recorder {
  record(input: KeyInput): KeystrokeEvent | null;
  snapshot(): KeystrokeEvent[];
}

export function createRecorder(now: () => number = () => performance.now()): Recorder {
  const start = now();
  const events: KeystrokeEvent[] = [];
  let lastT = 0;

  return {
    record(input) {
      if (events.length >= MAX_LOG_EVENTS) return null;

      const t = Math.max(lastT, Math.round(now() - start));
      const event = toEvent(input, t);
      if (!event) return null;

      lastT = t;
      events.push(event);
      return event;
    },
    snapshot() {
      return [...events];
    },
  };
}