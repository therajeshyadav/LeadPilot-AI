import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createTestServices } from "./helpers.js";

describe("lead APIs", () => {
  it("validates and creates a lead", async () => {
    const { services } = createTestServices();
    const app = createApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }), services);

    const response = await request(app).post("/api/leads").send({
      name: "Rahul",
      phone: "+919876543210",
      language: "HINDI",
      productType: "Apparel",
      productCount: 200,
      requiredFeatures: ["Payment Gateway", "payment gateway", "Coupons"],
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: "Rahul",
      phone: "+919876543210",
      language: "HINDI",
      requiredFeatures: ["payment gateway", "coupons"],
    });
  });

  it("rejects a non-E.164 phone number", async () => {
    const { services } = createTestServices();
    const app = createApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }), services);

    const response = await request(app).post("/api/leads").send({ phone: "9876543210" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("records a complete qualification and updates lead status", async () => {
    const { services } = createTestServices();
    const lead = await services.leads.create({ name: "Anita", phone: "+919876543211" });
    const app = createApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }), services);

    const response = await request(app).post(`/api/leads/${lead.id}/qualify`).send({
      classification: "HOT",
      score: 92,
      reasoning: "The buyer has a defined catalogue, a launch target, and asked for a proposal.",
      signals: {
        buyingIntent: "Requested a proposal and next-steps call.",
        budget: "Willing to discuss a defined project budget.",
        timeline: "Wants to launch next month.",
        requirements: "Needs payments, shipping, admin dashboard, and catalogue.",
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.classification).toBe("HOT");
    expect((await services.leads.get(lead.id)).leadStatus).toBe("HOT");
  });
});
