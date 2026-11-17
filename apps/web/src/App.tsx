import { useCallback, useState } from "react";
import type { KeystrokeLog } from "@ghostwriter/scoring";
import { ApiError, startRound, type Mode, type Round } from "./api.ts";
import HomeScreen, { type HomeError } from "./home/HomeScreen.tsx";
import TypingScreen from "./typing/TypingScreen.tsx";

type State =
  | { kind: "home"; starting: Mode | null; error: HomeError | null }
  | { kind: "typing"; round: Round }
  | { kind: "finished"; round: Round; log: KeystrokeLog };

function toHomeError(err: unknown): HomeError {
  if (err instanceof ApiError) {
    if (err.code === "already_attempted") return { kind: "attempt-used" };
    return { kind: "other", message: `The server said no (${err.code}).` };
  }
  return { kind: "network" };
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

  // Stable identity, so the typing screen doesn't re-attach its key listener every render.
  const finish = useCallback((log: KeystrokeLog) => {
    setState((s) => (s.kind === "typing" ? { kind: "finished", round: s.round, log } : s));
  }, []);

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

            <main className="flex flex-1 flex-col justify-center pb-14">
              {state.kind === "typing" && <TypingScreen passage={state.round.passage} onFinish={finish} />}
              {state.kind === "finished" && (
                <section className="mx-auto w-[46ch]">
                  <h2 className="m-0 font-display text-title font-normal">Finished</h2>
                  <p className="mt-3 text-body text-ink-2">
                    {state.log.length} keystrokes recorded. Sending them to the server for scoring is the next
                    step.
                  </p>
                </section>
              )}
            </main>
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