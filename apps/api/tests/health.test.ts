import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

const app = createApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }));

describe("GET /api/health", () => {
  it("returns the service health payload", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", service: "leadpilot-api" });
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });
});
