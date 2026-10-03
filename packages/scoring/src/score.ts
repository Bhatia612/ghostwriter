import { replay } from "./replay.js";
import type { KeystrokeLog, ScoreResult } from "./types.js";

export const CHARS_PER_WORD = 5;
const MAX_COMBO_BONUS = 0.5;

const round2 = (n: number) => Math.round(n * 100) / 100;

function correctPrefixLength(passage: string, typed: string): number {
    let i = 0;
    while (i < typed.length && typed[i] === passage[i]) i++;
    return i;
}

export function score(passage: string, log: KeystrokeLog): ScoreResult {
    const state = replay(passage, log);

    const correctChars = correctPrefixLength(passage, state.typed);


    const lastT = log.at(-1)?.t ?? 0;
    const endT = state.completed ? state.endT : lastT;
    const durationMs =
        state.startT === null || endT === null ? 0 : endT - state.startT;

    const minutes = durationMs / 60_000;
    const wpm = minutes > 0 ? correctChars / CHARS_PER_WORD / minutes : 0;

    const accuracy =
        state.totalKeystrokes > 0
            ? state.correctKeystrokes / state.totalKeystrokes
            : 0;

    const comboBonus = 1 + MAX_COMBO_BONUS * (state.maxCombo / passage.length);

    const finalScore = state.completed ? wpm * accuracy * comboBonus : 0;

    return {
        wpm: round2(wpm),
        accuracy: round2(accuracy),
        maxCombo: state.maxCombo,
        finalScore: round2(finalScore),
        correctChars,
        totalKeystrokes: state.totalKeystrokes,
        durationMs,
        completed: state.completed,
    };
}