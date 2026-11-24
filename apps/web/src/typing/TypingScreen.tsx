import { useEffect, useRef, useState } from "react";
import { replay, score, type KeystrokeEvent, type KeystrokeLog } from "@ghostwriter/scoring";
import { createRecorder, type Recorder } from "./capture.ts";
import { comboMeterPercent, comboTier } from "./combo.ts";

interface Props {
  passage: string;
  onFinish: (log: KeystrokeLog) => void;
  now?: () => number;
}

type CharState = "correct" | "wrong" | "cursor" | "pending";

const CHAR_CLASSES: Record<CharState, string> = {
  correct: "rounded-[2px] font-medium text-ink",
  wrong:
    "rounded-[2px] bg-wrong-bg font-bold text-wrong underline decoration-wavy decoration-wrong decoration-[1.5px] underline-offset-[7px] [text-decoration-skip-ink:none]",
  cursor:
    "rounded-[2px] bg-cursor-bg text-ink shadow-[inset_3px_0_0_var(--color-caret)] animate-blink motion-reduce:animate-none",
  pending: "rounded-[2px] font-normal text-pending",
};

export function charStates(passage: string, typed: string): CharState[] {
  let correctPrefix = 0;
  while (correctPrefix < typed.length && typed[correctPrefix] === passage[correctPrefix]) {
    correctPrefix++;
  }
  return [...passage].map((_, i) => {
    if (i < correctPrefix) return "correct";
    if (i < typed.length) return "wrong";
    if (i === typed.length) return "cursor";
    return "pending";
  });
}

export default function TypingScreen({ passage, onFinish, now }: Props) {
  const recorder = useRef<Recorder | null>(null);
  if (recorder.current === null) recorder.current = createRecorder(now);

  const finished = useRef(false);
  const [log, setLog] = useState<KeystrokeEvent[]>([]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (finished.current) return;
      const event = recorder.current!.record(e);
      if (!event) return;

      e.preventDefault();

      const next = recorder.current!.snapshot();
      setLog(next);

      if (replay(passage, next).completed) {
        finished.current = true;
        onFinish(next);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [passage, onFinish]);


  const state = replay(passage, log);
  const live = score(passage, log);
  const states = charStates(passage, state.typed);
  const tier = comboTier(state.combo);
  const meter = comboMeterPercent(state.combo);

  return (
    <div className="mx-auto w-[46ch] font-mono text-passage">
      <p className="mb-6 min-h-[1.5em] font-display text-body italic text-ink-2" data-testid="hint">
        {log.length === 0 ? "Start typing. The clock starts on your first key." : ""}
      </p>

      <p
        className="m-0 font-mono text-passage leading-[1.9] whitespace-break-spaces [font-variant-ligatures:none]"
        data-testid="passage"
        aria-label="Passage to type"
      >
        {[...passage].map((ch, i) => {
          const s = states[i]!;
          return (
            <span key={i} className={CHAR_CLASSES[s]} data-state={s}>
              {ch}
            </span>
          );
        })}
      </p>

      <dl className="mt-12 flex gap-16 border-t border-rule pt-6">
        <Stat label="WPM" testId="wpm" value={Math.round(live.wpm)} />
        <Stat label="Accuracy" testId="accuracy" value={`${Math.round(live.accuracy * 100)}%`} />
        <div className="flex min-w-[7ch] flex-col gap-2">
          <dt className="font-mono text-label tracking-[0.08em] text-ink-2 uppercase">Combo</dt>
          <dd className="m-0 font-display text-stat leading-none text-ink tabular-nums">
            <span
              key={state.combo}
              className={state.combo > 0 ? "inline-block animate-nudge motion-reduce:animate-none" : "inline-block"}
              data-testid="combo"
            >
              {state.combo}
            </span>
            {tier && (
              <span className="ml-2 text-body text-ink-2 italic" data-testid="combo-tier">
                {tier}
              </span>
            )}
            <span className="mt-3 block h-[3px] w-[12ch] bg-rule" aria-hidden="true">
              <i
                className={`block h-full ${meter === 100 ? "bg-ink" : "bg-caret"}`}
                style={{ width: `${meter}%` }}
              />
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Stat({ label, testId, value }: { label: string; testId: string; value: string | number }) {
  return (
    <div className="flex min-w-[7ch] flex-col gap-2">
      <dt className="font-mono text-label tracking-[0.08em] text-ink-2 uppercase">{label}</dt>
      <dd className="m-0 font-display text-stat leading-none text-ink tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}