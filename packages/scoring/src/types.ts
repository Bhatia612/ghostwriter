import { z } from "zod";

const printableAscii = /^[\x20-\x7E]$/;

export const keystrokeEventSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("char"),
        char: z.string().regex(printableAscii),
        t: z.number().int().nonnegative(),
    }),
    z.object({
        type: z.literal("backspace"),
        t: z.number().int().nonnegative(),
    }),
]);

export const MAX_LOG_EVENTS = 5000;

export const keystrokeLogSchema = z
    .array(keystrokeEventSchema)
    .max(MAX_LOG_EVENTS)
    .refine(
        (events) =>
            events.every((e, i) => i === 0 || e.t >= (events[i - 1]?.t ?? 0)),
        { message: "timestamps must be non-decreasing" }
    );

export type KeystrokeEvent = z.infer<typeof keystrokeEventSchema>;
export type KeystrokeLog = z.infer<typeof keystrokeLogSchema>;

export interface ScoreResult {
    wpm: number;
    accuracy: number;
    maxCombo: number;
    finalScore: number;
    correctChars: number;
    totalKeystrokes: number;
    durationMs: number;
    completed: boolean;
}