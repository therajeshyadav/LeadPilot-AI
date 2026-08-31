import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoiceService } from "../src/services/voice.service.js";
import { CallbackService } from "../src/services/callback.service.js";
import type { CalendarProvider } from "../src/integrations/calendar/calendar-provider.js";
import type { LeadIntelligenceProvider, CallbackIntent } from "../src/integrations/openai/lead-intelligence-provider.js";
import type { VoiceProvider } from "../src/integrations/voice/voice-provider.js";
import { createInMemoryRepositories } from "../src/repositories/in-memory-repositories.js";

describe("Calendar & Callback Integration", () => {
  let voiceService: VoiceService;
  let callbackService: CallbackService;
  let mockIntelligenceProvider: LeadIntelligenceProvider;
  let mockVoiceProvider: VoiceProvider;
  let mockCalendarProvider: CalendarProvider;
  let repositories: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    repositories = createInMemoryRepositories();

    mockCalendarProvider = {
      name: "test-calendar",
      createEvent: vi.fn().mockResolvedValue({ eventId: "cal_event_123" }),
    };

    mockIntelligenceProvider = {
      detectLanguage: vi.fn().mockResolvedValue("ENGLISH"),
      extractDiscovery: vi.fn().mockResolvedValue({
        budget: "$10,000",
        productType: "Electronics",
        requiredFeatures: ["payment gateway"],
      }),
      qualifyConversation: vi.fn().mockResolvedValue({
        classification: "WARM",
        score: 60,
        reasoning: "Some interest",
        signals: { buyingIntent: "", budget: "", timeline: "", requirements: "" },
      }),
      generateFollowUp: vi.fn().mockResolvedValue("Thank you for your interest!"),
      generateHotLeadMessage: vi.fn().mockResolvedValue("Hi! We'll send you a proposal shortly!"),
      detectCallbackIntent: vi.fn().mockResolvedValue({ requested: false }), // Default: no callback
    };

    mockVoiceProvider = {
      name: "test-voice",
      createOutboundCall: vi.fn().mockResolvedValue({
        providerCallId: "call_123",
        status: "in-progress",
        to: "+919876543210",
      }),
      endCall: vi.fn().mockResolvedValue(undefined),
      getCall: vi.fn().mockResolvedValue(null),
      parseAndVerifyWebhook: vi.fn().mockImplementation((body) => {
        const data = JSON.parse(body.toString());
        return Promise.resolve({
          eventId: "event_123",
          type: data.message.type,
          providerCallId: data.message.call.id,
          occurredAt: new Date(data.message.timestamp),
          transcript: data.message.transcript,
          detectedLanguage: "ENGLISH" as const,
          payload: data,
        });
      }),
    };

    callbackService = new CallbackService(
      repositories.callbacks,
      repositories.leads,
      mockCalendarProvider
    );

    voiceService = new VoiceService(
      repositories.conversations,
      repositories.leads,
      mockVoiceProvider,
      mockIntelligenceProvider,
      undefined, // No WhatsApp for these tests
      callbackService
    );
  });

  // Helper: send an end-of-call-report event to trigger post-call processing (callback detection)
  async function sendCallEndEvent(providerCallId: string, transcript: string) {
    const endEvent = {
      type: "end-of-call-report",
      providerCallId,
      occurredAt: new Date(),
      transcript,
    };
    await voiceService.handleWebhookEvent(
      Buffer.from(JSON.stringify({ message: { type: endEvent.type, call: { id: endEvent.providerCallId }, timestamp: endEvent.occurredAt.toISOString(), transcript: endEvent.transcript } })),
      {}
    );
  }

  describe("Callback Intent Detection", () => {

    it("should detect callback intent and schedule callback", async () => {
      // Mock callback intent detection
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: true,
        date: tomorrowStr,
        timeOfDay: "morning",
        originalText: "Can you call me tomorrow morning?",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "Test Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      const conversation = await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "I'm interested in your service. Can you call me tomorrow morning to discuss the details?",
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Trigger call end to run post-call callback detection
      await sendCallEndEvent("call_123", event.transcript);

      // Verify callback was created
      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(1);
      expect(callbacks.items[0].sourceText).toContain("tomorrow morning");

      // Verify calendar event was created
      expect(mockCalendarProvider.createEvent).toHaveBeenCalled();
    });

    it("should handle explicit date/time callback request", async () => {
      // Use tomorrow's date to avoid past date issue
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
      
      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: true,
        date: tomorrowStr,
        timeOfDay: "specific",
        specificTime: "17:00",
        originalText: "Call me tomorrow at 5 PM",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "Test Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "Call me tomorrow at 5 PM to discuss the project details and pricing.",
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Trigger call end to run post-call callback detection
      await sendCallEndEvent("call_123", event.transcript);

      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(1);
      
      const scheduledDate = callbacks.items[0].scheduledFor;
      expect(scheduledDate.getHours()).toBe(17); // 5 PM
      expect(scheduledDate.getMinutes()).toBe(0);
    });

    it("should use morning default time when timeOfDay is morning", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: true,
        date: tomorrow.toISOString().split('T')[0],
        timeOfDay: "morning",
        originalText: "Call me tomorrow morning",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "Morning Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "I would like to discuss more about this. Can you call me tomorrow morning to talk about e-commerce features?",
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Trigger call end to run post-call callback detection
      await sendCallEndEvent("call_123", event.transcript);

      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(1);
      
      // Should use DEFAULT_CALLBACK_MORNING_HOUR (default 10)
      expect(callbacks.items[0].scheduledFor.getHours()).toBe(10);
    });

    it("should use afternoon default time when timeOfDay is afternoon", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: true,
        date: tomorrow.toISOString().split('T')[0],
        timeOfDay: "afternoon",
        originalText: "Call me tomorrow afternoon",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "Afternoon Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "Let's talk tomorrow afternoon about the e-commerce platform.",
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Trigger call end to run post-call callback detection
      await sendCallEndEvent("call_123", event.transcript);

      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(1);
      
      // Should use DEFAULT_CALLBACK_AFTERNOON_HOUR (default 15)
      expect(callbacks.items[0].scheduledFor.getHours()).toBe(15);
    });

    it("should use evening default time when timeOfDay is evening", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: true,
        date: tomorrow.toISOString().split('T')[0],
        timeOfDay: "evening",
        originalText: "Call me tomorrow evening",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "Evening Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "This sounds interesting. Can you call me tomorrow evening when I'm done with work? That would work better for my schedule.",
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Trigger call end to run post-call callback detection
      await sendCallEndEvent("call_123", event.transcript);

      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(1);
      
      // Should use DEFAULT_CALLBACK_EVENING_HOUR (default 18)
      expect(callbacks.items[0].scheduledFor.getHours()).toBe(18);
    });

    it("should NOT schedule callback when intent is not detected", async () => {
      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: false,
        originalText: "",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "No Callback Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "Thank you for the information. I'll think about it and get back to you.",
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(0);
    });

    it("should handle calendar API failures gracefully", async () => {
      // Mock calendar failure
      (mockCalendarProvider.createEvent as any).mockRejectedValue(new Error("Google Calendar API failed"));

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: true,
        date: tomorrow.toISOString().split('T')[0],
        timeOfDay: "afternoon",
        originalText: "Call me tomorrow afternoon",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "Test Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "Please call me tomorrow afternoon to discuss the project requirements.",
      };

      // Should not throw, should handle gracefully
      await expect(voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      )).resolves.toBeUndefined();

      // Trigger call end to run post-call callback detection
      await sendCallEndEvent("call_123", event.transcript);

      // Callback should still be created in database
      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(1);
    });

    it("should handle Hindi callback request", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      (mockIntelligenceProvider.detectLanguage as any).mockResolvedValue("HINDI");
      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: true,
        date: tomorrow.toISOString().split('T')[0],
        timeOfDay: "morning",
        originalText: "कल सुबह मुझे फोन करें",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "Hindi Customer",
        phone: "+919876543210",
        language: "HINDI",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "HINDI",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "मुझे आपकी सेवा में बहुत रुचि है और मैं इसके बारे में और जानना चाहता हूं। कल सुबह मुझे फोन करें।",
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Trigger call end to run post-call callback detection
      await sendCallEndEvent("call_123", event.transcript);

      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(1);
      expect(callbacks.items[0].sourceText).toContain("कल सुबह मुझे फोन करें");
    });

    it("should handle Telugu callback request", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      (mockIntelligenceProvider.detectLanguage as any).mockResolvedValue("TELUGU");
      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: true,
        date: tomorrow.toISOString().split('T')[0],
        timeOfDay: "evening",
        originalText: "రేపు సాయంత్రం నాకు ఫోన్ చేయండి",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "Telugu Customer",
        phone: "+919876543210",
        language: "TELUGU",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "TELUGU",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "మీ సేవలో నాకు ఆసక్తి ఉంది. రేపు సాయంత్రం నాకు ఫోన్ చేయండి.",
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Trigger call end to run post-call callback detection
      await sendCallEndEvent("call_123", event.transcript);

      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(1);
      expect(callbacks.items[0].sourceText).toContain("రేపు సాయంత్రం నాకు ఫోన్ చేయండి");
    });

    it("should use Asia/Kolkata timezone by default", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      (mockIntelligenceProvider.detectCallbackIntent as any).mockResolvedValue({
        requested: true,
        date: tomorrow.toISOString().split('T')[0],
        timeOfDay: "afternoon",
        originalText: "Call me tomorrow afternoon",
      } as CallbackIntent);

      const lead = await repositories.leads.create({
        name: "Test Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_123",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "I'm interested in your e-commerce development services. Please call me tomorrow afternoon to discuss the project requirements and pricing.",
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Trigger call end to run post-call callback detection
      await sendCallEndEvent("call_123", event.transcript);

      const callbacks = await repositories.callbacks.list({ limit: 10, offset: 0, leadId: lead.id });
      expect(callbacks.items).toHaveLength(1);
      expect(callbacks.items[0].timezone).toBe("Asia/Kolkata");
    });
  });

  describe("Google Calendar Integration", () => {
    it("should create calendar event with correct parameters", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const lead = await repositories.leads.create({
        name: "Calendar Test Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      const result = await callbackService.schedule(lead.id, {
        scheduledFor: tomorrow,
        timezone: "Asia/Kolkata",
        sourceText: "Customer requested callback tomorrow morning",
      });

      expect(result.calendarSync).toBe("created");
      expect(mockCalendarProvider.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Calendar Test Customer"),
          scheduledFor: tomorrow,
          timezone: "Asia/Kolkata",
        })
      );
    });

    it("should include lead context in calendar event description", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const lead = await repositories.leads.create({
        name: "Context Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await callbackService.schedule(lead.id, {
        scheduledFor: tomorrow,
        timezone: "Asia/Kolkata",
        sourceText: "Call me tomorrow",
      });

      expect(mockCalendarProvider.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining(lead.id),
        })
      );
    });
  });
});
