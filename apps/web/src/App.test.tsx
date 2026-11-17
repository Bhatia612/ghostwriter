import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App.tsx";
import * as api from "./api.ts";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("App", () => {
    it("shows the passage after starting a practice round", async () => {
        vi.spyOn(api, "startRound").mockResolvedValue({
            roundId: "r1",
            mode: "practice",
            date: "2026-11-17",
            passage: "quick river stone",
            expiresAt: "2026-11-17T10:10:00.000Z",
        });

        render(<App />);
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));

        expect((await screen.findByTestId("passage")).textContent).toBe("quick river stone");
        expect(api.startRound).toHaveBeenCalledWith("practice");
    });

    it("explains a used-up ranked attempt in plain words", async () => {
        vi.spyOn(api, "startRound").mockRejectedValue(new api.ApiError(409, "already_attempted"));

        render(<App />);
        fireEvent.click(screen.getByRole("button", { name: "Today's ranked run" }));

        expect((await screen.findByRole("alert")).textContent).toMatch(/already used today's ranked attempt/);
    });

    it("says the server is unreachable when fetch itself fails", async () => {
        vi.spyOn(api, "startRound").mockRejectedValue(new TypeError("Failed to fetch"));

        render(<App />);
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));

        expect((await screen.findByRole("alert")).textContent).toMatch(/Couldn't reach the server/);
    });

    it("disables the buttons while a round is starting", async () => {
        let resolve!: (r: api.Round) => void;
        vi.spyOn(api, "startRound").mockReturnValue(new Promise((r) => (resolve = r)));

        render(<App />);
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));

        expect(screen.getByRole("button", { name: "Practice" })).toHaveProperty("disabled", true);
        resolve({ roundId: "r", mode: "practice", date: "d", passage: "p", expiresAt: "e" });
        await screen.findByTestId("passage");
    });
});