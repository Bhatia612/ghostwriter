import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { keystrokeLogSchema, score } from "@ghostwriter/scoring";
import TypingScreen, { charStates } from "./TypingScreen.tsx";

afterEach(cleanup);

function steppingClock() {
  let time = 0;
  return () => (time += 100);
}

function press(key: string, extra: Partial<KeyboardEventInit> = {}) {
  return fireEvent.keyDown(window, { key, ...extra });
}

function type(text: string) {
  for (const ch of text) press(ch);
}

function renderTyping(passage: string, onFinish = vi.fn()) {
  return render(
    <TypingScreen passage={passage} onFinish={onFinish} now={steppingClock()} />,
  );
}

const states = () =>
  [...screen.getByTestId("passage").querySelectorAll("span")].map((s) => s.dataset.state);


describe("charStates", () => {
  it("marks the correct prefix, the wrong part, the cursor and the rest", () => {
    expect(charStates("cats", "cx")).toEqual(["correct", "wrong", "cursor", "pending"]);
  });

  it("treats a right letter after an uncorrected mistake as wrong", () => {
    expect(charStates("cats", "cxt")).toEqual(["correct", "wrong", "wrong", "cursor"]);
  });

  it("puts the cursor at the start before typing", () => {
    expect(charStates("ab", "")).toEqual(["cursor", "pending"]);
  });
});

describe("TypingScreen", () => {
  it("shows the passage with the cursor on the first character", () => {
    renderTyping("cat");
    expect(screen.getByTestId("passage").textContent).toBe("cat");
    expect(states()).toEqual(["cursor", "pending", "pending"]);
  });


  it("marks correct and wrong characters as you type", () => {
    renderTyping("cats");
    type("cx");
    expect(states()).toEqual(["correct", "wrong", "cursor", "pending"]);
  });

  it("removes the last character on Backspace and resets the combo", () => {
    renderTyping("cats");
    type("ca");
    expect(screen.getByTestId("combo").textContent).toBe("2");
    press("Backspace");
    expect(states()).toEqual(["correct", "cursor", "pending", "pending"]);
    expect(screen.getByTestId("combo").textContent).toBe("0");
  });

  it("ignores keys that aren't typing", () => {
    renderTyping("cats");
    press("Shift");
    press("a", { ctrlKey: true });
    press("é");
    expect(states()).toEqual(["cursor", "pending", "pending", "pending"]);
  });

  it("stops Space from scrolling the page", () => {
    renderTyping("a b");
    press("a");
    expect(press(" ")).toBe(false);
  });

  it("leaves keys it ignores alone, so browser shortcuts still work", () => {
    renderTyping("cats");
    expect(press("r", { ctrlKey: true })).toBe(true);
  });

  it("finishes exactly once with a log the server will accept", () => {
    const onFinish = vi.fn();
    renderTyping("cat", onFinish);
    type("cx");
    press("Backspace");
    type("at");
    type("zzz");

    expect(onFinish).toHaveBeenCalledTimes(1);
    const log = onFinish.mock.calls[0]![0];
    expect(keystrokeLogSchema.safeParse(log).success).toBe(true);
    expect(score("cat", log).completed).toBe(true);
    expect(log).toHaveLength(5);
  });

  it("names the combo tier and has none for short streaks", () => {
    render(<TypingScreen passage={"a".repeat(30)} onFinish={vi.fn()} now={steppingClock()} />);
    type("a".repeat(9));
    expect(screen.queryByTestId("combo-tier")).toBeNull();
    type("a");
    expect(screen.getByTestId("combo-tier").textContent).toBe("steady");
    type("a".repeat(15));
    expect(screen.getByTestId("combo-tier").textContent).toBe("flowing");
  });

  it("shows live stats from the shared scoring code", () => {
    renderTyping("cat");
    type("cat");
    expect(screen.getByTestId("wpm").textContent).toBe("180");
    expect(screen.getByTestId("accuracy").textContent).toBe("100%");
    expect(screen.getByTestId("combo").textContent).toBe("3");
  });

  it("shows the hint before the first key and keeps its line after", () => {
    render(<TypingScreen passage="cat" onFinish={vi.fn()} now={steppingClock()} />);
    expect(screen.getByTestId("hint").textContent).toMatch(/Start typing/);

    press("c");

    // Emptied, not removed: removing it would make the passage jump up.
    expect(screen.getByTestId("hint").textContent).toBe("");
  });
});