import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ScoreResult } from "@ghostwriter/scoring";
import ResultsScreen from "./ResultsScreen.tsx";
import type { Mode } from "../api.ts";

afterEach(cleanup);

const passage = "the cat sat on the mat";

function setup(mode: Mode, result: Partial<ScoreResult> = {}) {
    const onPractice = vi.fn();
    const onHome = vi.fn();
    render(
        <ResultsScreen
            round={{ roundId: "r1", mode, date: "2026-11-19", passage, expiresAt: "x" }}
            log={Array.from({ length: 25 }, (_, i) => ({ type: "char" as const, char: "a", t: i }))}
            response={{
                roundId: "r1",
                mode,
                date: "2026-11-19",
                replayed: false,
                result: {
                    wpm: 78.4,
                    accuracy: 0.97,
                    maxCombo: 63,
                    finalScore: 1284.4,
                    correctChars: passage.length,
                    totalKeystrokes: 23,
                    durationMs: 27_830,
                    completed: true,
                    ...result,
                },
            }}
            onPractice={onPractice}
            onHome={onHome}
            now={() => new Date("2026-11-19T10:26:08Z")}
        />
    );
    return { onPractice, onHome };
}

describe("ResultsScreen", () => {
    it("shows the server's score and stats", () => {
        setup("ranked");
        expect(screen.getByTestId("final-score").textContent).toBe("1,284");
        for (const text of ["78", "97%", "63", "0:27.8"]) expect(screen.getByText(text)).toBeTruthy();
        expect(screen.getByText(/Calculated on the server from 25 keystrokes/)).toBeTruthy();
    });

    it("tells a ranked player when the next passage opens", () => {
        setup("ranked");
        expect(screen.getByText("Come back tomorrow.")).toBeTruthy();
        expect(screen.getByRole("timer").textContent).toBe("13:33:52");
    });

    it("offers another practice run after practice", () => {
        setup("practice");
        expect(screen.getByRole("button", { name: /Practice again/ })).toBeTruthy();
        expect(screen.queryByRole("timer")).toBeNull();
    });

    it("explains an unfinished run instead of just showing 0", () => {
        setup("ranked", { completed: false, finalScore: 0, correctChars: 11 });
        expect(screen.getByTestId("final-score").textContent).toBe("0");
        expect(screen.getByText(/You wrote 3 of 6 words/)).toBeTruthy();
    });

    describe("keys", () => {
        it("P starts practice and Esc goes home after a ranked run", () => {
            const { onPractice, onHome } = setup("ranked");
            fireEvent.keyDown(window, { key: "p" });
            fireEvent.keyDown(window, { key: "Escape" });
            expect(onPractice).toHaveBeenCalledTimes(1);
            expect(onHome).toHaveBeenCalledTimes(1);
        });

        it("Enter starts another practice run", () => {
            const { onPractice } = setup("practice");
            fireEvent.keyDown(window, { key: "Enter" });
            expect(onPractice).toHaveBeenCalledTimes(1);
        });

        it("leaves Enter on a focused button to the button, so it fires once", () => {
            const { onPractice } = setup("practice");
            const button = screen.getByRole("button", { name: /Practice again/ });
            fireEvent.keyDown(button, { key: "Enter" });
            expect(onPractice).not.toHaveBeenCalled();
        });

        it("ignores shortcuts with Ctrl held", () => {
            const { onPractice } = setup("ranked");
            fireEvent.keyDown(window, { key: "p", ctrlKey: true });
            expect(onPractice).not.toHaveBeenCalled();
        });
    });
});