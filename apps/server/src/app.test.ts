import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("app", () => {
  const app = createApp();

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not_found" });
  });

  it("returns JSON 400 for malformed JSON bodies", async () => {
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send('{"broken": ');
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual({ error: "entity.parse.failed" });
  });

  it("returns JSON 413 for bodies over the size limit", async () => {
    const big = JSON.stringify({ data: "x".repeat(300 * 1024) });
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send(big);
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "entity.too.large" });
  });

  it("accepts a body near the size a max-length log would be", async () => {
    const events = Array.from({ length: 5000 }, (_, i) => ({
      type: "char",
      char: "a",
      t: 100000 + i,
    }));
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(events));

    expect(res.status).toBe(404);
  });
});