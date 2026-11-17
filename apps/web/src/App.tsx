import { useState } from "react";
import { ApiError, startRound, type Mode, type Round } from "./api.ts";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; round: Round }
  | { kind: "error"; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  already_attempted: "You've already used today's ranked attempt. Try practice instead.",
};

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return ERROR_MESSAGES[err.code] ?? `The server said no (${err.code}).`;
  }
  return "Couldn't reach the server. Is it running?";
}

export default function App() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function start(mode: Mode) {
    setState({ kind: "loading" });
    try {
      const round = await startRound(mode);
      setState({ kind: "ready", round });
    } catch (err) {
      setState({ kind: "error", message: errorMessage(err) });
    }
  }

  const busy = state.kind === "loading";

  return (
    <main>
      <h1>Ghostwriter</h1>

      <button onClick={() => start("ranked")} disabled={busy}>
        Today's ranked run
      </button>{" "}
      <button onClick={() => start("practice")} disabled={busy}>
        Practice
      </button>

      {state.kind === "loading" && <p>Starting…</p>}
      {state.kind === "error" && (
        <p role="alert" className="error">
          {state.message}
        </p>
      )}
      {state.kind === "ready" && (
        <section>
          <p>
            {state.round.mode} · {state.round.date}
          </p>
          <p className="passage" data-testid="passage">
            {state.round.passage}
          </p>
        </section>
      )}
    </main>
  );
}