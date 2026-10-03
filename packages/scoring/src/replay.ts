import type { KeystrokeLog } from "./types.js";

export interface ReplayState {
    typed: string;
    combo: number;
    maxCombo: number;
    correctKeystrokes: number;
    totalKeystrokes: number;
    completed: boolean;
    startT: number | null;
    endT: number | null;
}

export function replay(passage: string, log: KeystrokeLog): ReplayState {
    const state: ReplayState = {
        typed: "",
        combo: 0,
        maxCombo: 0,
        correctKeystrokes: 0,
        totalKeystrokes: 0,
        completed: false,
        startT: null,
        endT: null,
    };

    for (const event of log) {
        if (state.completed) break;

        if (event.type === "backspace") {
            if (state.typed.length === 0) continue;
            state.typed = state.typed.slice(0, -1);
            state.combo = 0;
            continue;
        }

        if (state.typed.length >= passage.length) continue;

        if (state.startT === null) state.startT = event.t;

        const nextTyped = state.typed + event.char;
        state.typed = nextTyped;
        state.totalKeystrokes++;

        if (passage.startsWith(nextTyped)) {
            state.correctKeystrokes++;
            state.combo++;
            state.maxCombo = Math.max(state.maxCombo, state.combo);
        } else {
            state.combo = 0;
        }

        if (nextTyped === passage) {
            state.completed = true;
            state.endT = event.t;
        }
    }

    return state;
}