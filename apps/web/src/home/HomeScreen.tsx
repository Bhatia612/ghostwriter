import { useEffect, useState } from "react";
import type { Mode } from "../api.ts";
import { formatCountdown, formatUtcDate, msUntilUtcMidnight } from "./countdown.ts";

export type HomeError = { kind: "attempt-used" } | { kind: "network" } | { kind: "other"; message: string };

interface Props {
  starting: Mode | null;
  rankedUsed: boolean;
  error: HomeError | null;
  onStart: (mode: Mode) => void;
  now?: () => Date;
}

export default function HomeScreen({ starting, rankedUsed, error, onStart, now = () => new Date() }: Props) {
  const [time, setTime] = useState(now);

  useEffect(() => {
    const id = setInterval(() => setTime(now()), 1000);
    return () => clearInterval(id);
  }, [now]);


  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || starting) return;
      const key = e.key.toLowerCase();
      if (key === "r" && !rankedUsed) onStart("ranked");
      if (key === "p") onStart("practice");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [starting, rankedUsed, onStart]);

  const busy = starting !== null;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="max-w-[820px] flex-1 px-[120px] pt-16 pb-8">
        <p className="m-0 font-mono text-label tracking-[0.08em] text-ink-2 uppercase">The daily passage</p>
        <h1 className="mt-3 mb-0 font-display text-display leading-none font-normal tracking-[-0.01em] italic">
          Ghostwriter
        </h1>
        <p className="mt-5 mb-12 text-lead text-ink-2">
          {formatUtcDate(time)}
          <span className="ml-2 font-mono text-label tracking-[0.08em] uppercase">UTC</span>
        </p>

        <div className="flex flex-col" role="group" aria-label="Choose a run">
          <ActionButton
            id="ranked"
            title={starting === "ranked" ? "Starting…" : "Today's ranked run"}
            description="One attempt per day, the same passage for everyone. Once it starts, it counts."
            tag={rankedUsed ? "Used today" : undefined}
            shortcut="R"
            disabled={busy || rankedUsed}
            onClick={() => onStart("ranked")}
          />
          <ActionButton
            id="practice"
            title={starting === "practice" ? "Starting…" : "Practice"}
            description="Unlimited runs on other passages. Nothing is ranked."
            shortcut="P"
            disabled={busy}
            onClick={() => onStart("practice")}
          />
        </div>

        {error && <ErrorNotice error={error} />}

        <p className="mt-6 max-w-[56ch] text-small leading-normal text-ink-2">
          Scores are worked out on the server from your keystrokes, so every run is judged the same way.
        </p>
      </main>

      <footer className="flex items-center justify-between px-[120px] pb-8 font-mono text-label text-ink-2">
        <span>
          Next passage in{" "}
          <span className="text-ink tabular-nums" data-testid="countdown">
            {formatCountdown(msUntilUtcMidnight(time))}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Kbd>R</Kbd> ranked
          <span className="w-4" />
          <Kbd>P</Kbd> practice
        </span>
      </footer>
    </div>
  );
}

function ActionButton(props: {
  id: string;
  title: string;
  description: string;
  tag?: string;
  shortcut: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-labelledby={`${props.id}-title`}
      aria-describedby={`${props.id}-desc`}
      className="flex w-full cursor-pointer items-center justify-between gap-8 border-0 border-t border-rule bg-transparent py-6 pr-6 pl-8 text-left font-[inherit] text-inherit last:border-b focus-visible:bg-paper-2 focus-visible:shadow-[inset_3px_0_0_var(--color-caret)] focus-visible:outline-none disabled:cursor-default"
    >
      <span>
        <span
          id={`${props.id}-title`}
          className={`block text-title leading-[1.15] ${props.disabled ? "text-pending" : ""}`}
        >
          {props.title}
        </span>
        <span id={`${props.id}-desc`} className={`mt-2 block text-body ${props.disabled ? "text-pending" : "text-ink-2"}`}>
          {props.description}
        </span>
      </span>
      <span className="flex flex-none items-center gap-4">
        {props.tag && (
          <span className="font-mono text-label tracking-[0.06em] text-ink-2 uppercase">{props.tag}</span>
        )}
        <Kbd>{props.shortcut}</Kbd>
      </span>
    </button>
  );
}

function ErrorNotice({ error }: { error: HomeError }) {
  const network = error.kind === "network";
  const text =
    error.kind === "attempt-used"
      ? "You've already used today's ranked attempt. Try practice instead."
      : error.kind === "network"
        ? "Couldn't reach the server. Is it running?"
        : error.message;

  return (
    <p
      role="alert"
      className={`mt-6 flex items-start gap-3 px-6 py-4 font-display text-body leading-normal ${
        network ? "bg-wrong-bg text-wrong" : "bg-paper-2 text-ink"
      }`}
    >
      <svg
        className="mt-[3px] h-5 w-5 flex-none"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {network ? (
          <>
            <path d="M3 12.5a7 7 0 0 1 2.3-5.2" />
            <path d="M17 12.5a7 7 0 0 0-5.6-6.9" />
            <path d="M7 13a3 3 0 0 1 1.4-2.5" />
            <path d="M10 15.5v.1" strokeWidth="2" />
            <path d="M3 3l14 14" />
          </>
        ) : (
          <>
            <circle cx="10" cy="10" r="8.25" />
            <path d="M10 9v5" />
            <path d="M10 6.2v.1" strokeWidth="2" />
          </>
        )}
      </svg>
      <span>
        {text}
        {network && <span className="mt-1 block text-small">Press R or P to try again.</span>}
      </span>
    </p>
  );
}

export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-block min-w-[1.4em] rounded-[3px] border border-b-2 border-rule px-[7px] py-[2px] text-center font-mono text-label leading-[1.4] text-ink-2">
      {children}
    </kbd>
  );
}