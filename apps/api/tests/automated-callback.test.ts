import { describe, it, expect, beforeEach, vi } from "vitest";
import { createInMemoryRepositories } from "../src/repositories/in-memory-repositories.js";
import { CallbackService } from "../src/services/callback.service.js";
import type { VoiceProvider, VoiceCall } from "../src/integrations/voice/voice-provider.js";
import type { Repositories } from "../src/repositories/contracts.js";

describe("Automated Callback System", () => {
  let repositories: Repositories;
  let mockVoiceProvider: VoiceProvider;
  let callbackService: CallbackService;
  const testAssistantId = "test-assistant-123";

  beforeEach(() => {
    repositories = createInMemoryRepositories();
    
    // Mock voice provider
    mockVoiceProvider = {
      name: "mock-vapi",
      createOutboundCall: vi.fn(),
      endCall: vi.fn(),
      getCall: vi.fn(),
      parseAndVerifyWebhook: vi.fn(),
    };

    callbackService = new CallbackService(
      repositories.callbacks,
      repositories.leads,
      undefined, // no calendar
      mockVoiceProvider,
      testAssistantId
    );
  });

  describe("processPendingCallbacks", () => {
    it("should trigger outbound call for due callback", async () => {
      // Mock successful outbound call
      (mockVoiceProvider.createOutboundCall as any).mockResolvedValue({
        providerCallId: "call_123",
        status: "initiated",
        to: "+919876543210",
      } as VoiceCall);

      // Create a lead
      const lead = await repositories.leads.create({
        phone: "+919876543210",
        name: "Test Customer",
        language: "ENGLISH",
      });

      // Create a callback scheduled in the past (due now)
      const pastTime = new Date(Date.now() - 60000); // 1 minute ago
      const callback = await repositories.callbacks.create({
        leadId: lead.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "Call me back tomorrow morning",
      });

      // Process pending callbacks
      const triggeredCount = await callbackService.processPendingCallbacks();

      // Verify
      expect(triggeredCount).toBe(1);
      expect(mockVoiceProvider.createOutboundCall).toHaveBeenCalledWith({
        to: "+919876543210",
        leadId: lead.id,
        assistantId: testAssistantId,
        metadata: expect.objectContaining({
          callbackId: callback.id,
        }),
      });

      // Check callback status
      const updatedCallback = await repositories.callbacks.list({ limit: 10, offset: 0 });
      expect(updatedCallback.items[0].status).toBe("PROCESSING");
      expect(updatedCallback.items[0].providerCallId).toBe("call_123");
      expect(updatedCallback.items[0].triggeredAt).toBeTruthy();
    });

    it("should NOT trigger callback scheduled in the future", async () => {
      const lead = await repositories.leads.create({
        phone: "+919876543210",
        name: "Test Customer",
      });

      // Create a callback scheduled in the future
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      await repositories.callbacks.create({
        leadId: lead.id,
        scheduledFor: futureTime,
        timezone: "Asia/Kolkata",
        sourceText: "Call me tomorrow",
      });

      // Process pending callbacks
      const triggeredCount = await callbackService.processPendingCallbacks();

      // Verify
      expect(triggeredCount).toBe(0);
      expect(mockVoiceProvider.createOutboundCall).not.toHaveBeenCalled();

      // Callback should still be SCHEDULED
      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0 });
      expect(callbacks.items[0].status).toBe("SCHEDULED");
    });

    it("should prevent duplicate calls (already PROCESSING)", async () => {
      (mockVoiceProvider.createOutboundCall as any).mockResolvedValue({
        providerCallId: "call_123",
        status: "initiated",
        to: "+919876543210",
      });

      const lead = await repositories.leads.create({
        phone: "+919876543210",
      });

      const pastTime = new Date(Date.now() - 60000);
      const callback = await repositories.callbacks.create({
        leadId: lead.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "Call me back",
      });

      // First processing
      await callbackService.processPendingCallbacks();
      expect(mockVoiceProvider.createOutboundCall).toHaveBeenCalledTimes(1);

      // Second processing attempt (callback is now PROCESSING)
      await callbackService.processPendingCallbacks();
      
      // Should NOT create another call
      expect(mockVoiceProvider.createOutboundCall).toHaveBeenCalledTimes(1);
    });

    it("should mark callback as FAILED if outbound call fails", async () => {
      (mockVoiceProvider.createOutboundCall as any).mockRejectedValue(
        new Error("Vapi API error: insufficient balance")
      );

      const lead = await repositories.leads.create({
        phone: "+919876543210",
      });

      const pastTime = new Date(Date.now() - 60000);
      await repositories.callbacks.create({
        leadId: lead.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "Call me back",
      });

      // Process (will fail)
      const triggeredCount = await callbackService.processPendingCallbacks();
      expect(triggeredCount).toBe(0);

      // Check callback is marked FAILED
      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0 });
      expect(callbacks.items[0].status).toBe("FAILED");
      expect(callbacks.items[0].failureReason).toContain("Vapi API error");
    });

    it("should NOT repeatedly call after failure", async () => {
      (mockVoiceProvider.createOutboundCall as any).mockRejectedValue(new Error("API error"));

      const lead = await repositories.leads.create({
        phone: "+919876543210",
      });

      const pastTime = new Date(Date.now() - 60000);
      await repositories.callbacks.create({
        leadId: lead.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "Call me",
      });

      // First attempt (fails)
      await callbackService.processPendingCallbacks();
      expect(mockVoiceProvider.createOutboundCall).toHaveBeenCalledTimes(1);

      // Second attempt
      await callbackService.processPendingCallbacks();
      
      // Should NOT retry failed callback
      expect(mockVoiceProvider.createOutboundCall).toHaveBeenCalledTimes(1);
    });

    it("should handle timezone correctly", async () => {
      (mockVoiceProvider.createOutboundCall as any).mockResolvedValue({
        providerCallId: "call_123",
        status: "initiated",
        to: "+919876543210",
      });

      const lead = await repositories.leads.create({
        phone: "+919876543210",
        name: "Mumbai Customer",
      });

      // Scheduled for a specific time in IST
      const scheduledTime = new Date("2026-08-29T11:00:00+05:30"); // 11 AM IST
      await repositories.callbacks.create({
        leadId: lead.id,
        scheduledFor: scheduledTime,
        timezone: "Asia/Kolkata",
        sourceText: "kal subah 11 baje call karo",
      });

      // Mock current time to be after scheduled time
      vi.setSystemTime(new Date("2026-08-29T11:01:00+05:30"));

      const triggeredCount = await callbackService.processPendingCallbacks();
      expect(triggeredCount).toBe(1);

      vi.useRealTimers();
    });

    it("should process multiple pending callbacks", async () => {
      (mockVoiceProvider.createOutboundCall as any).mockResolvedValue({
        providerCallId: "call_123",
        status: "initiated",
        to: "+919876543210",
      });

      // Create 3 leads with callbacks
      const lead1 = await repositories.leads.create({ phone: "+919876543211" });
      const lead2 = await repositories.leads.create({ phone: "+919876543212" });
      const lead3 = await repositories.leads.create({ phone: "+919876543213" });

      const pastTime = new Date(Date.now() - 60000);

      await repositories.callbacks.create({
        leadId: lead1.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "callback 1",
      });

      await repositories.callbacks.create({
        leadId: lead2.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "callback 2",
      });

      await repositories.callbacks.create({
        leadId: lead3.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "callback 3",
      });

      const triggeredCount = await callbackService.processPendingCallbacks();
      
      expect(triggeredCount).toBe(3);
      expect(mockVoiceProvider.createOutboundCall).toHaveBeenCalledTimes(3);
    });

    it("should not process callbacks if voice provider not configured", async () => {
      // Create callback service without voice provider
      const serviceWithoutVoice = new CallbackService(
        repositories.callbacks,
        repositories.leads,
        undefined,
        undefined, // no voice provider
        undefined
      );

      const lead = await repositories.leads.create({ phone: "+919876543210" });
      const pastTime = new Date(Date.now() - 60000);
      
      await repositories.callbacks.create({
        leadId: lead.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "callback",
      });

      const triggeredCount = await serviceWithoutVoice.processPendingCallbacks();
      
      expect(triggeredCount).toBe(0);
    });
  });

  describe("Callback completion", () => {
    it("should mark callback as COMPLETED when call ends", async () => {
      (mockVoiceProvider.createOutboundCall as any).mockResolvedValue({
        providerCallId: "call_abc123",
        status: "initiated",
        to: "+919876543210",
      });

      const lead = await repositories.leads.create({
        phone: "+919876543210",
      });

      const pastTime = new Date(Date.now() - 60000);
      const callback = await repositories.callbacks.create({
        leadId: lead.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "call me back",
      });

      // Trigger callback
      await callbackService.processPendingCallbacks();

      // Verify it's PROCESSING
      let updatedCallback = await repositories.callbacks.list({ limit: 1, offset: 0 });
      expect(updatedCallback.items[0].status).toBe("PROCESSING");
      expect(updatedCallback.items[0].providerCallId).toBe("call_abc123");

      // Simulate call completion
      await callbackService.markAsCompleted(callback.id);

      // Verify it's COMPLETED
      updatedCallback = await repositories.callbacks.list({ limit: 1, offset: 0 });
      expect(updatedCallback.items[0].status).toBe("COMPLETED");
      expect(updatedCallback.items[0].completedAt).toBeTruthy();
    });

    it("should find callback by providerCallId", async () => {
      (mockVoiceProvider.createOutboundCall as any).mockResolvedValue({
        providerCallId: "call_unique_123",
        status: "initiated",
        to: "+919876543210",
      });

      const lead = await repositories.leads.create({
        phone: "+919876543210",
      });

      const pastTime = new Date(Date.now() - 60000);
      await repositories.callbacks.create({
        leadId: lead.id,
        scheduledFor: pastTime,
        timezone: "Asia/Kolkata",
        sourceText: "callback",
      });

      // Trigger callback
      await callbackService.processPendingCallbacks();

      // Find by providerCallId
      const foundCallback = await callbackService.findByProviderCallId("call_unique_123");
      
      expect(foundCallback).toBeTruthy();
      expect(foundCallback?.providerCallId).toBe("call_unique_123");
      expect(foundCallback?.status).toBe("PROCESSING");
    });
  });
});
