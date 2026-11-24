import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, startRound, submitRound } from "./api.ts";

function mockFetch(status: number, body: unknown, asJson = true) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: asJson ? async () => body : async () => { throw new SyntaxError("not json"); },
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startRound", () => {
  it("posts the mode as JSON with the cookie included", async () => {
    const fetch = mockFetch(201, { roundId: "r1", passage: "hello" });

    await startRound("practice");

    expect(fetch).toHaveBeenCalledWith("/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mode: "practice" }),
    });
  });

  it("returns the round from the server", async () => {
    mockFetch(201, { roundId: "r1", mode: "ranked", passage: "hello world" });
    const round = await startRound("ranked");
    expect(round.passage).toBe("hello world");
  });

  it("throws an ApiError carrying the server's error code", async () => {
    mockFetch(409, { error: "already_attempted" });
    await expect(startRound("ranked")).rejects.toMatchObject({
      status: 409,
      code: "already_attempted",
    });
  });

  it("still throws a usable error when the body is not JSON", async () => {
    mockFetch(502, null, false);
    const err = await startRound("ranked").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, code: "unknown_error" });
  });
});

describe("submitRound", () => {
  const log = [{ type: "char" as const, char: "a", t: 0 }];
  const ok = { roundId: "r1", mode: "practice", date: "d", result: { finalScore: 1 }, replayed: false };
  const noWait = { wait: () => Promise.resolve() };

  function respond(...steps: Array<{ status: number; body: unknown } | "network-error">) {
    const fn = vi.fn();
    for (const step of steps) {
      if (step === "network-error") fn.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      else
        fn.mockResolvedValueOnce({
          ok: step.status < 300,
          status: step.status,
          json: async () => step.body,
        });
    }
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("posts the log to the round's submit URL", async () => {
    const fetch = respond({ status: 200, body: ok });
    await submitRound("r1", log, noWait);
    expect(fetch).toHaveBeenCalledWith(
      "/rounds/r1/submit",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ log }) })
    );
  });

  it("retries after a network failure and returns the result", async () => {
    const fetch = respond("network-error", { status: 200, body: ok });
    await expect(submitRound("r1", log, noWait)).resolves.toEqual(ok);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries a server error", async () => {
    const fetch = respond({ status: 503, body: {} }, { status: 200, body: ok });
    await submitRound("r1", log, noWait);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx, because the answer won't change", async () => {
    const fetch = respond({ status: 410, body: { error: "round_expired" } });
    await expect(submitRound("r1", log, noWait)).rejects.toMatchObject({ code: "round_expired" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after three attempts", async () => {
    const fetch = respond("network-error", "network-error", "network-error");
    await expect(submitRound("r1", log, noWait)).rejects.toBeInstanceOf(TypeError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("waits longer before each retry", async () => {
    respond("network-error", "network-error", { status: 200, body: ok });
    const waits: number[] = [];
    await submitRound("r1", log, { wait: async (ms) => void waits.push(ms) });
    expect(waits).toEqual([250, 500]);
  });

  it("escapes the round id in the URL", async () => {
    const fetch = respond({ status: 200, body: ok });
    await submitRound("a/../b", log, noWait);
    expect(fetch.mock.calls[0]![0]).toBe("/rounds/a%2F..%2Fb/submit");
  });
});