import { describe, expect, it } from "vitest";

import { createTestServices } from "./helpers.js";

describe("CallbackService", () => {
  it("stores callbacks internally when Calendar is not configured", async () => {
    const { services } = createTestServices();
    const lead = await services.leads.create({ name: "Sita", phone: "+919876543212" });

    const result = await services.callbacks.schedule(lead.id, {
      scheduledFor: new Date(Date.now() + 3_600_000),
      timezone: "Asia/Kolkata",
      sourceText: "Call me tomorrow morning",
    });

    expect(result.calendarSync).toBe("not-configured");
    expect(result.callback).toMatchObject({ leadId: lead.id, timezone: "Asia/Kolkata", status: "SCHEDULED" });
  });

  it("rejects an invalid timezone", async () => {
    const { services } = createTestServices();
    const lead = await services.leads.create({ name: "Vijay", phone: "+919876543213" });

    await expect(
      services.callbacks.schedule(lead.id, {
        scheduledFor: new Date(Date.now() + 3_600_000),
        timezone: "Not/A_Timezone",
        sourceText: "Tomorrow morning",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
