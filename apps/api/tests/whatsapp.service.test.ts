import { describe, expect, it } from "vitest";

import { createTestServices } from "./helpers.js";

describe("WhatsAppService", () => {
  it("does not send duplicate messages for the same idempotency key", async () => {
    const { services, provider } = createTestServices();
    const lead = await services.leads.create({ name: "Kiran", phone: "+919876543214" });
    const input = {
      type: "HOT_LEAD" as const,
      message: "Thanks for your interest. Our consultant will contact you shortly.",
      idempotencyKey: `hot:${lead.id}:conversation-1`,
    };

    const first = await services.whatsapp.send(lead.id, input);
    const second = await services.whatsapp.send(lead.id, input);

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(provider.textRequests).toHaveLength(1);
    expect(second.message.id).toBe(first.message.id);
  });

  it("persists a failed outbound attempt without claiming delivery", async () => {
    const { services, provider } = createTestServices();
    provider.shouldFail = true;
    const lead = await services.leads.create({ name: "Meera", phone: "+919876543215" });

    await expect(
      services.whatsapp.send(lead.id, { type: "MANUAL", message: "Following up on our conversation." }),
    ).rejects.toMatchObject({ code: "INTEGRATION_FAILURE" });

    const [stored] = await services.whatsapp.listForLead(lead.id);
    expect(stored?.status).toBe("FAILED");
    expect(stored?.providerMessageId).toBeNull();
  });
});
