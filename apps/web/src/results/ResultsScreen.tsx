import { useEffect, useState } from "react";
import type { KeystrokeLog } from "@ghostwriter/scoring";
import type { Round, SubmitResponse } from "../api.ts";
import { formatCountdown, msUntilUtcMidnight } from "../home/countdown.ts";
import { Kbd } from "../home/HomeScreen.tsx";
import { formatAccuracy, formatDuration, formatScore, wordsCompleted } from "./format.ts";

interface Props {
    round: Round;
    log: KeystrokeLog;
    response: SubmitResponse;
    onPractice: () => void;
    onHome: () => void;
    now?: () => Date;
}

const label = "m-0 font-mono text-label tracking-[0.08em] text-ink-2 uppercase";
const btn =
    "inline-flex cursor-pointer items-center gap-3 rounded-[2px] border border-ink px-6 py-3 font-display text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-caret";
const btnPrimary = `${btn} bg-ink text-paper`;

export default function ResultsScreen({ round, log, response, onPractice, onHome, now = () => new Date() }: Props) {
    const { result } = response;
    const ranked = round.mode === "ranked";
    const [time, setTime] = useState(now);

    useEffect(() => {
        if (!ranked) return;
        const id = setInterval(() => setTime(now()), 1000);
        return () => clearInterval(id);
    }, [ranked, now]);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            if (e.target instanceof HTMLButtonElement && e.key === "Enter") return;
            const key = e.key.toLowerCase();
            if (key === "escape") onHome();
            else if (ranked && key === "p") onPractice();
            else if (!ranked && e.key === "Enter") onPractice();
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [ranked, onPractice, onHome]);

    const totalWords = round.passage.split(" ").length;
    const done = wordsCompleted(round.passage, result.correctChars);

    return (
        <div className="grid flex-1 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] px-24 pt-[72px] pb-16">
            <section className="pr-16">
                <p className={label}>Final score</p>
                {result.completed ? (
                    <p className="mt-2 mb-0 font-display text-[128px] leading-none tracking-[-0.02em]" data-testid="final-score">
                        {formatScore(result.finalScore)}
                    </p>
                ) : (
                    <div className="flex items-end gap-8">
                        <p className="mt-2 mb-0 font-display text-[128px] leading-none text-pending" data-testid="final-score">
                            0
                        </p>
                        <p className="mt-0 mb-[14px] max-w-[34ch] text-body leading-normal text-ink-2">
                            <strong className="font-medium text-ink">This run stopped before the last word,</strong> so it
                            scores 0. You wrote {done} of {totalWords} words. Here is how those went.
                        </p>
                    </div>
                )}

                <dl className="mt-12 flex gap-16 border-t border-rule pt-6">
                    <Stat label="WPM" value={String(Math.round(result.wpm))} muted={!result.completed} />
                    <Stat label="Accuracy" value={formatAccuracy(result.accuracy)} muted={!result.completed} />
                    <Stat label="Max combo" value={String(result.maxCombo)} muted={!result.completed} />
                    <Stat label="Time" value={formatDuration(result.durationMs)} muted={!result.completed} />
                </dl>

                <p className="mt-6 max-w-[56ch] text-small leading-normal text-ink-2">
                    Calculated on the server from {log.length} keystrokes.
                </p>
            </section>

            <section className="flex flex-col justify-center border-l border-rule pl-16">
                {ranked ? (
                    <>
                        <h2 className="mt-0 mb-8 font-display text-title leading-[1.2] font-normal">Come back tomorrow.</h2>
                        <p className={label}>Next passage in</p>
                        <p className="mt-2 mb-0 font-mono text-[48px] font-medium tabular-nums" role="timer">
                            {formatCountdown(msUntilUtcMidnight(time))}
                        </p>
                        <p className="mt-3 mb-0 text-small leading-normal text-ink-2">
                            A new passage opens every day at 00:00 UTC.
                        </p>
                        <div className="mt-10 flex gap-4">
                            <button type="button" className={btnPrimary} onClick={onPractice}>
                                Practice <PrimaryKbd>P</PrimaryKbd>
                            </button>
                            <button type="button" className={btn} onClick={onHome}>
                                Home <Kbd>Esc</Kbd>
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2 className="mt-0 mb-0 font-display text-title leading-[1.2] font-normal">Practice run</h2>
                        <p className="mt-3 mb-0 text-small leading-normal text-ink-2">
                            Practice doesn't count toward today's ranking. Each run gives you a different passage.
                        </p>
                        <div className="mt-10 flex gap-4">
                            <button type="button" className={btnPrimary} onClick={onPractice}>
                                Practice again <PrimaryKbd>Enter</PrimaryKbd>
                            </button>
                            <button type="button" className={btn} onClick={onHome}>
                                Home <Kbd>Esc</Kbd>
                            </button>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

function Stat({ label: text, value, muted }: { label: string; value: string; muted: boolean }) {
    return (
        <div className="flex min-w-[7ch] flex-col gap-2">
            <dt className={label}>{text}</dt>
            <dd className={`m-0 font-display text-stat leading-none tabular-nums ${muted ? "text-ink-2" : "text-ink"}`}>
                {value}
            </dd>
        </div>
    );
}

function PrimaryKbd({ children }: { children: string }) {
    return (
        <kbd className="inline-block min-w-[1.4em] rounded-[3px] border border-b-2 border-paper px-[7px] py-[2px] text-center font-mono text-label leading-[1.4] text-paper">
            {children}
        </kbd>
    );
}