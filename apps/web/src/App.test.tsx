import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App.tsx";
import * as api from "./api.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const round = (passage: string, mode: api.Mode = "practice"): api.Round => ({
  roundId: "r1",
  mode,
  date: "2026-11-17",
  passage,
  expiresAt: "2026-11-17T10:10:00.000Z",
});

const rankedButton = () => screen.getByRole("button", { name: "Today's ranked run" });
const practiceButton = () => screen.getByRole("button", { name: "Practice" });

describe("App", () => {
  it("shows the passage after starting a practice round", async () => {
    vi.spyOn(api, "startRound").mockResolvedValue(round("quick river stone"));

    render(<App />);
    fireEvent.click(practiceButton());

    expect((await screen.findByTestId("passage")).textContent).toBe("quick river stone");
    expect(api.startRound).toHaveBeenCalledWith("practice");
  });

  it("names each button by its title and reads the description after it", () => {
    render(<App />);
    expect(rankedButton()).toHaveProperty("disabled", false);
    expect(practiceButton().getAttribute("aria-describedby")).toBe("practice-desc");
  });

  it("explains a used-up ranked attempt and switches the ranked button off", async () => {
    vi.spyOn(api, "startRound").mockRejectedValue(new api.ApiError(409, "already_attempted"));

    render(<App />);
    fireEvent.click(rankedButton());

    expect((await screen.findByRole("alert")).textContent).toMatch(/already used today's ranked attempt/);
    expect(rankedButton()).toHaveProperty("disabled", true);
    expect(screen.getByText("Used today")).toBeTruthy();
    expect(practiceButton()).toHaveProperty("disabled", false);
  });

  it("says the server is unreachable when fetch itself fails", async () => {
    vi.spyOn(api, "startRound").mockRejectedValue(new TypeError("Failed to fetch"));

    render(<App />);
    fireEvent.click(practiceButton());

    expect((await screen.findByRole("alert")).textContent).toMatch(/Couldn't reach the server/);
  });

  it("disables both buttons and labels the clicked one while starting", async () => {
    let resolve!: (r: api.Round) => void;
    vi.spyOn(api, "startRound").mockReturnValue(new Promise((r) => (resolve = r)));

    render(<App />);
    fireEvent.click(practiceButton());

    const starting = screen.getByRole("button", { name: "Starting…" });
    expect(starting).toHaveProperty("disabled", true);
    expect(rankedButton()).toHaveProperty("disabled", true);

    resolve(round("p"));
    await screen.findByTestId("passage");
  });

  describe("keyboard shortcuts", () => {
    it("starts practice with P and a ranked run with R", async () => {
      const spy = vi.spyOn(api, "startRound").mockResolvedValue(round("abc"));

      render(<App />);
      fireEvent.keyDown(window, { key: "p" });
      await screen.findByTestId("passage");
      expect(spy).toHaveBeenLastCalledWith("practice");

      cleanup();
      render(<App />);
      fireEvent.keyDown(window, { key: "R" });
      await screen.findByTestId("passage");
      expect(spy).toHaveBeenLastCalledWith("ranked");
    });

    it("ignores Ctrl+R so the browser can still reload", () => {
      const spy = vi.spyOn(api, "startRound").mockResolvedValue(round("abc"));
      render(<App />);
      fireEvent.keyDown(window, { key: "r", ctrlKey: true });
      expect(spy).not.toHaveBeenCalled();
    });

    it("never treats a typed p or r in the passage as a shortcut", async () => {
      const spy = vi.spyOn(api, "startRound").mockResolvedValue(round("pr"));
      vi.spyOn(api, "submitRound").mockReturnValue(new Promise(() => { }));

      render(<App />);
      fireEvent.click(practiceButton());
      await screen.findByTestId("passage");
      spy.mockClear();

      fireEvent.keyDown(window, { key: "p" });
      fireEvent.keyDown(window, { key: "r" });

      expect(spy).not.toHaveBeenCalled();
      expect(await screen.findByRole("status")).toBeTruthy();
    });

    it("does not offer R once today's ranked attempt is used", async () => {
      const spy = vi.spyOn(api, "startRound").mockRejectedValue(new api.ApiError(409, "already_attempted"));
      render(<App />);
      fireEvent.click(rankedButton());
      await screen.findByRole("alert");
      spy.mockClear();

      fireEvent.keyDown(window, { key: "r" });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("finishing a run", () => {
    const serverResponse = (mode: api.Mode, finalScore: number): api.SubmitResponse => ({
      roundId: "r1",
      mode,
      date: "2026-11-17",
      replayed: false,
      result: {
        wpm: 60, accuracy: 1, maxCombo: 3, finalScore, correctChars: 3,
        totalKeystrokes: 3, durationMs: 3000, completed: true,
      },
    });

    async function playPractice(passage = "cat") {
      vi.spyOn(api, "startRound").mockResolvedValue(round(passage));
      render(<App />);
      fireEvent.click(practiceButton());
      await screen.findByTestId("passage");
      await act(async () => {
        for (const ch of passage) fireEvent.keyDown(window, { key: ch });
      });
    }

    it("sends the exact recorded log and shows the server's score, not its own", async () => {
      const submit = vi.spyOn(api, "submitRound").mockResolvedValue(serverResponse("practice", 4321));
      await playPractice("cat");

      // Deliberately different from what the browser would calculate.
      expect((await screen.findByTestId("final-score")).textContent).toBe("4,321");
      const [roundId, log] = submit.mock.calls[0]!;
      expect(roundId).toBe("r1");
      expect(log.map((e) => (e.type === "char" ? e.char : "BS"))).toEqual(["c", "a", "t"]);
    });

    it("shows that it is sending while the server works", async () => {
      vi.spyOn(api, "submitRound").mockReturnValue(new Promise(() => { }));
      await playPractice();
      expect((await screen.findByRole("status")).textContent).toMatch(/Sending your run/);
    });

    it("keeps the run and resends the same log after a failed submit", async () => {
      const submit = vi
        .spyOn(api, "submitRound")
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(serverResponse("practice", 900));
      await playPractice("cat");

      expect((await screen.findByRole("alert")).textContent).toMatch(/nothing is lost/);
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect((await screen.findByTestId("final-score")).textContent).toBe("900");
      expect(submit.mock.calls[1]![1]).toEqual(submit.mock.calls[0]![1]);
    });

    it("does not offer a retry when the run expired", async () => {
      vi.spyOn(api, "submitRound").mockRejectedValue(new api.ApiError(410, "round_expired"));
      await playPractice();
      expect((await screen.findByRole("alert")).textContent).toMatch(/expired/);
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });

    it("goes back home with Esc from the results", async () => {
      vi.spyOn(api, "submitRound").mockResolvedValue(serverResponse("practice", 10));
      await playPractice();
      await screen.findByTestId("final-score");
      fireEvent.keyDown(window, { key: "Escape" });
      expect(practiceButton()).toBeTruthy();
    });
  });

  it("labels a run with its mode and date", async () => {
    vi.spyOn(api, "startRound").mockResolvedValue(round("cat"));
    render(<App />);
    fireEvent.click(practiceButton());
    expect(await screen.findByText("practice · 2026-11-17")).toBeTruthy();
  });

  it("shows a countdown to the next UTC passage", () => {
    render(<App />);
    expect(screen.getByTestId("countdown").textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});