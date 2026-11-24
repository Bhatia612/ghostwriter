import { useCallback, useState } from "react";
import type { KeystrokeLog } from "@ghostwriter/scoring";
import { ApiError, startRound, submitRound, type Mode, type Round, type SubmitResponse } from "./api.ts";
import HomeScreen, { type HomeError } from "./home/HomeScreen.tsx";
import ResultsScreen from "./results/ResultsScreen.tsx";
import TypingScreen from "./typing/TypingScreen.tsx";

type SubmitError = { message: string; canRetry: boolean };

type State =
  | { kind: "home"; starting: Mode | null; error: HomeError | null }
  | { kind: "typing"; round: Round }
  | { kind: "submitting"; round: Round; log: KeystrokeLog }
  | { kind: "results"; round: Round; log: KeystrokeLog; response: SubmitResponse }
  | { kind: "submit-failed"; round: Round; log: KeystrokeLog; error: SubmitError };

function toHomeError(err: unknown): HomeError {
  if (err instanceof ApiError) {
    if (err.code === "already_attempted") return { kind: "attempt-used" };
    return { kind: "other", message: `The server said no (${err.code}).` };
  }
  return { kind: "network" };
}

function toSubmitError(err: unknown): SubmitError {
  if (err instanceof ApiError) {
    if (err.code === "round_expired") {
      return { message: "This run took too long, so it expired and wasn't scored.", canRetry: false };
    }
    if (err.code === "implausible_timing") {
      return { message: "The server couldn't verify this run's timing, so it wasn't scored.", canRetry: false };
    }
    if (err.status < 500) return { message: `The server rejected this run (${err.code}).`, canRetry: false };
  }
  // Network down or a server error, even after retrying. Retrying later is safe:
  // the server returns the original result if it already scored this run.
  return { message: "Couldn't send your run. Your keystrokes are kept here, so nothing is lost.", canRetry: true };
}

export default function App() {
  const [state, setState] = useState<State>({ kind: "home", starting: null, error: null });
  // Learned from the server: once it says the attempt is used, the button stays off.
  const [rankedUsed, setRankedUsed] = useState(false);

  const start = useCallback(async (mode: Mode) => {
    setState({ kind: "home", starting: mode, error: null });
    try {
      const round = await startRound(mode);
      if (mode === "ranked") setRankedUsed(true);
      setState({ kind: "typing", round });
    } catch (err) {
      const error = toHomeError(err);
      if (error.kind === "attempt-used") setRankedUsed(true);
      setState({ kind: "home", starting: null, error });
    }
  }, []);

  const send = useCallback(async (round: Round, log: KeystrokeLog) => {
    setState({ kind: "submitting", round, log });
    try {
      const response = await submitRound(round.roundId, log);
      setState({ kind: "results", round, log, response });
    } catch (err) {
      setState({ kind: "submit-failed", round, log, error: toSubmitError(err) });
    }
  }, []);

  // Stable while a run is in progress, so the typing screen keeps one key listener.
  const typingRound = state.kind === "typing" ? state.round : null;
  const finish = useCallback(
    (log: KeystrokeLog) => {
      if (typingRound) void send(typingRound, log);
    },
    [typingRound, send]
  );

  const practice = useCallback(() => void start("practice"), [start]);
  const goHome = useCallback(() => setState({ kind: "home", starting: null, error: null }), []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SmallScreenNotice />

      {/* The game needs a physical keyboard, so it only shows on wider screens. */}
      <div className="hidden md:block">
        {state.kind === "home" && (
          <HomeScreen starting={state.starting} rankedUsed={rankedUsed} error={state.error} onStart={start} />
        )}

        {state.kind !== "home" && (
          <div className="flex min-h-screen flex-col">
            <header className="flex items-baseline justify-between px-24 pt-8">
              <span className="font-display text-[22px] italic">Ghostwriter</span>
              <span className="font-mono text-[14px] text-ink-2">
                {state.round.mode} · {state.round.date}
              </span>
            </header>

            {state.kind === "results" ? (
              <ResultsScreen
                round={state.round}
                log={state.log}
                response={state.response}
                onPractice={practice}
                onHome={goHome}
              />
            ) : (
              <main className="flex flex-1 flex-col justify-center pb-14">
                {state.kind === "typing" && <TypingScreen passage={state.round.passage} onFinish={finish} />}

                {state.kind === "submitting" && (
                  <p className="mx-auto w-[46ch] font-display text-title italic text-ink-2" role="status">
                    Sending your run for scoring…
                  </p>
                )}

                {state.kind === "submit-failed" && (
                  <section className="mx-auto w-[46ch]">
                    <p role="alert" className="m-0 bg-wrong-bg px-6 py-4 font-display text-body leading-normal text-wrong">
                      {state.error.message}
                    </p>
                    <div className="mt-8 flex gap-4">
                      {state.error.canRetry && (
                        <button
                          type="button"
                          autoFocus
                          onClick={() => void send(state.round, state.log)}
                          className="cursor-pointer rounded-[2px] border border-ink bg-ink px-6 py-3 font-display text-body text-paper focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-caret"
                        >
                          Try again
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={goHome}
                        className="cursor-pointer rounded-[2px] border border-ink px-6 py-3 font-display text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-caret"
                      >
                        Home
                      </button>
                    </div>
                  </section>
                )}
              </main>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SmallScreenNotice() {
  return (
    <div className="flex min-h-screen flex-col justify-center px-8 py-10 md:hidden">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <rect x="4" y="12" width="36" height="22" rx="2" />
        <path d="M10 19h2M16 19h2M22 19h2M28 19h2M10 25h2M16 25h12M33 25h1" />
      </svg>
      <p className="mt-4 mb-0 font-display text-[40px] leading-none italic">Ghostwriter</p>
      <p className="mt-7 mb-0 text-[24px] leading-[1.3]">Best on a computer with a keyboard.</p>
      <p className="mt-4 mb-0 text-[17px] leading-normal text-ink-2">
        Every passage is written key by key, so it needs a physical keyboard.
      </p>
    </div>
  );
}