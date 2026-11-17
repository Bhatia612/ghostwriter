import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, startRound } from "./api.ts";

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