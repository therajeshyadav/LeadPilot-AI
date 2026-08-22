import { describe, it, expect, vi, beforeEach } from "vitest";
import { WhatsAppService } from "../src/services/whatsapp.service.js";
import { VoiceService } from "../src/services/voice.service.js";
import type { WhatsAppProvider } from "../src/integrations/whatsapp/whatsapp-provider.js";
import type { LeadIntelligenceProvider } from "../src/integrations/openai/lead-intelligence-provider.js";
import type { VoiceProvider } from "../src/integrations/voice/voice-provider.js";
import { createInMemoryRepositories } from "../src/repositories/in-memory-repositories.js";

describe("HOT Lead WhatsApp Integration", () => {
  let whatsappService: WhatsAppService;
  let voiceService: VoiceService;
  let mockWhatsAppProvider: WhatsAppProvider;
  let mockIntelligenceProvider: LeadIntelligenceProvider;
  let mockVoiceProvider: VoiceProvider;
  let repositories: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    repositories = createInMemoryRepositories();
    
    mockWhatsAppProvider = {
      name: "test-whatsapp",
      sendText: vi.fn().mockResolvedValue({ providerMessageId: "WA123" }),
      sendMedia: vi.fn().mockResolvedValue({ providerMessageId: "WA124" }),
    };

    mockIntelligenceProvider = {
      detectLanguage: vi.fn().mockResolvedValue("ENGLISH"),
      extractDiscovery: vi.fn().mockResolvedValue({
        budget: "$5000-10000",
        productType: "Electronics",
        requiredFeatures: ["payment gateway", "inventory management"],
      }),
      qualifyConversation: vi.fn(),
      generateFollowUp: vi.fn().mockResolvedValue("Thank you for your interest!"),
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

    whatsappService = new WhatsAppService(
      repositories.whatsappMessages,
      repositories.leads,
      mockWhatsAppProvider
    );

    voiceService = new VoiceService(
      repositories.conversations,
      repositories.leads,
      mockVoiceProvider,
      mockIntelligenceProvider,
      whatsappService
    );
  });

  describe("sendHotLeadAlert", () => {
    it("should send HOT lead WhatsApp with discovered information", async () => {
      const lead = await repositories.leads.create({
        name: "John Doe",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      const result = await whatsappService.sendHotLeadAlert({
        leadId: lead.id,
        conversationId: "conv_123",
        leadData: lead,
        discoveredInfo: {
          budget: "$5000-10000",
          productType: "Electronics",
          timeline: "Next month",
          requirements: ["payment gateway", "inventory management"],
        },
        language: "ENGLISH",
        salesContactPhone: "+91-9876543210",
      });

      expect(result.idempotent).toBe(false);
      expect(mockWhatsAppProvider.sendText).toHaveBeenCalledWith({
        to: "+919876543210",
        body: expect.stringContaining("Hi John Doe!"),
        idempotencyKey: "hot_lead_conv_123_" + lead.id,
      });

      const sentMessage = (mockWhatsAppProvider.sendText as any).mock.calls[0][0].body;
      expect(sentMessage).toContain("Electronics");
      expect(sentMessage).toContain("$5000-10000");
      expect(sentMessage).toContain("Next month");
      expect(sentMessage).toContain("payment gateway, inventory management");
      expect(sentMessage).toContain("+91-9876543210");
    });

    it("should prevent duplicate HOT lead WhatsApp for same conversation", async () => {
      const lead = await repositories.leads.create({
        name: "Jane Smith",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      const input = {
        leadId: lead.id,
        conversationId: "conv_duplicate",
        leadData: lead,
        language: "ENGLISH" as const,
      };

      // First call should send
      const result1 = await whatsappService.sendHotLeadAlert(input);
      expect(result1.idempotent).toBe(false);

      // Second call should be idempotent
      const result2 = await whatsappService.sendHotLeadAlert(input);
      expect(result2.idempotent).toBe(true);

      expect(mockWhatsAppProvider.sendText).toHaveBeenCalledTimes(1);
    });

    it("should generate Hindi WhatsApp message for Hindi-speaking lead", async () => {
      const lead = await repositories.leads.create({
        name: "राहुल",
        phone: "+919876543210",
        language: "HINDI",
      });

      await whatsappService.sendHotLeadAlert({
        leadId: lead.id,
        leadData: lead,
        discoveredInfo: {
          productType: "कपड़े",
          budget: "₹50,000",
        },
        language: "HINDI",
      });

      const sentMessage = (mockWhatsAppProvider.sendText as any).mock.calls[0][0].body;
      expect(sentMessage).toContain("नमस्ते राहुल!");
      expect(sentMessage).toContain("कपड़े");
      expect(sentMessage).toContain("₹50,000");
      expect(sentMessage).toContain("detailed proposal");
    });

    it("should generate Telugu WhatsApp message for Telugu-speaking lead", async () => {
      const lead = await repositories.leads.create({
        name: "రామ్",
        phone: "+919876543210",
        language: "TELUGU",
      });

      await whatsappService.sendHotLeadAlert({
        leadId: lead.id,
        leadData: lead,
        discoveredInfo: {
          productType: "వస్త్రాలు",
        },
        language: "TELUGU",
      });

      const sentMessage = (mockWhatsAppProvider.sendText as any).mock.calls[0][0].body;
      expect(sentMessage).toContain("నమస్కారం రామ్!");
      expect(sentMessage).toContain("వస్త్రాలు");
    });

    it("should handle missing lead information gracefully", async () => {
      const lead = await repositories.leads.create({
        phone: "+919876543210", // no name
        language: "ENGLISH",
      });

      await whatsappService.sendHotLeadAlert({
        leadId: lead.id,
        leadData: lead,
        language: "ENGLISH",
      });

      const sentMessage = (mockWhatsAppProvider.sendText as any).mock.calls[0][0].body;
      expect(sentMessage).toContain("Hi Customer!"); // fallback name
      expect(sentMessage).not.toContain("undefined");
    });
  });

  describe("Mid-Call HOT Lead Detection", () => {
    it("should detect HOT lead and send WhatsApp during live call", async () => {
      // Mock HOT qualification
      (mockIntelligenceProvider.qualifyConversation as any).mockResolvedValue({
        classification: "HOT",
        score: 85,
        reasoning: "Strong buying intent with clear requirements",
        signals: {
          buyingIntent: "Ready to proceed",
          budget: "Mentioned 10K budget",
          timeline: "Needs to launch next month",
          requirements: "Payment gateway essential",
        },
      });

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

      // Simulate transcript received event (this should trigger HOT detection)
      const event = {
        eventId: "event_123",
        type: "transcript_received",
        providerCallId: "call_123",
        occurredAt: new Date(),
        transcript: "Yes, I need an e-commerce website with payment gateway. My budget is around 10K and I want to launch next month. This looks perfect for my electronics business!",
        detectedLanguage: "ENGLISH" as const,
        payload: {},
      };

      // This should trigger the mid-call HOT detection and WhatsApp
      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Verify WhatsApp was sent
      expect(mockWhatsAppProvider.sendText).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+919876543210",
          body: expect.stringContaining("Hi Test Customer!"),
          idempotencyKey: `hot_lead_${conversation.id}_${lead.id}`,
        })
      );

      // Verify lead status was updated to HOT
      const updatedLead = await repositories.leads.findById(lead.id);
      expect(updatedLead?.leadStatus).toBe("HOT");
    });

    it("should NOT send WhatsApp for WARM lead during call", async () => {
      (mockIntelligenceProvider.qualifyConversation as any).mockResolvedValue({
        classification: "WARM",
        score: 60,
        reasoning: "Some interest but unclear budget",
      });

      const lead = await repositories.leads.create({
        name: "Maybe Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_456",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        eventId: "event_456",
        type: "transcript_received",
        providerCallId: "call_456",
        occurredAt: new Date(),
        transcript: "Maybe I need a website, not sure about budget yet",
        detectedLanguage: "ENGLISH" as const,
        payload: {},
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Should NOT send WhatsApp for WARM leads
      expect(mockWhatsAppProvider.sendText).not.toHaveBeenCalled();
    });

    it("should NOT send WhatsApp for COLD lead during call", async () => {
      (mockIntelligenceProvider.qualifyConversation as any).mockResolvedValue({
        classification: "COLD",
        score: 20,
        reasoning: "No buying intent",
      });

      const lead = await repositories.leads.create({
        name: "Not Interested",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_789",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        eventId: "event_789",
        type: "transcript_received",
        providerCallId: "call_789",
        occurredAt: new Date(),
        transcript: "Not interested in any website right now",
        detectedLanguage: "ENGLISH" as const,
        payload: {},
      };

      await voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      );

      // Should NOT send WhatsApp for COLD leads
      expect(mockWhatsAppProvider.sendText).not.toHaveBeenCalled();
    });

    it("should handle WhatsApp failures gracefully without disrupting call", async () => {
      (mockIntelligenceProvider.qualifyConversation as any).mockResolvedValue({
        classification: "HOT",
        score: 90,
        reasoning: "Very interested",
      });

      // Mock WhatsApp failure
      (mockWhatsAppProvider.sendText as any).mockRejectedValue(new Error("WhatsApp API failed"));

      const lead = await repositories.leads.create({
        name: "Hot Lead",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      await repositories.conversations.create({
        leadId: lead.id,
        providerCallId: "call_fail",
        startedAt: new Date(),
        detectedLanguage: "ENGLISH",
      });

      const event = {
        eventId: "event_fail",
        type: "transcript_received",
        providerCallId: "call_fail",
        occurredAt: new Date(),
        transcript: "I want to buy this right now! I need a complete e-commerce solution with payment gateway, shipping integration, and inventory management. My budget is flexible and I want to launch within 2 weeks.",
        detectedLanguage: "ENGLISH" as const,
        payload: {},
      };

      // Should not throw error even if WhatsApp fails
      await expect(voiceService.handleWebhookEvent(
        Buffer.from(JSON.stringify({ message: { type: event.type, call: { id: event.providerCallId }, timestamp: event.occurredAt.toISOString(), transcript: event.transcript } })),
        {}
      )).resolves.toBeUndefined();

      expect(mockWhatsAppProvider.sendText).toHaveBeenCalled();
    });
  });

  describe("Post-Call Follow-up", () => {
    it("should send contextual follow-up with media after call ends", async () => {
      const lead = await repositories.leads.create({
        name: "Follow Up Customer",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      const result = await whatsappService.sendFollowUpMessage({
        leadId: lead.id,
        conversationId: "conv_followup",
        message: "Thank you for the great conversation! Here are the details we discussed...",
        mediaUrls: ["https://example.com/architecture.jpg", "https://example.com/resume.pdf"],
      });

      expect(result.idempotent).toBe(false);

      // First call should be sendMedia with the main message and first attachment
      expect(mockWhatsAppProvider.sendMedia).toHaveBeenCalledWith({
        to: "+919876543210",
        body: "Thank you for the great conversation! Here are the details we discussed...",
        mediaUrl: "https://example.com/architecture.jpg",
        idempotencyKey: "followup_conv_followup",
      });

      // Second call should be for additional media
      expect(mockWhatsAppProvider.sendMedia).toHaveBeenCalledWith({
        to: "+919876543210",
        body: "",
        mediaUrl: "https://example.com/resume.pdf",
        idempotencyKey: "followup_conv_followup_media_1",
      });
    });

    it("should prevent duplicate follow-up messages", async () => {
      const lead = await repositories.leads.create({
        name: "Duplicate Test",
        phone: "+919876543210",
        language: "ENGLISH",
      });

      const input = {
        leadId: lead.id,
        conversationId: "conv_dup_followup",
        message: "Follow up message",
      };

      const result1 = await whatsappService.sendFollowUpMessage(input);
      expect(result1.idempotent).toBe(false);

      const result2 = await whatsappService.sendFollowUpMessage(input);
      expect(result2.idempotent).toBe(true);

      expect(mockWhatsAppProvider.sendText).toHaveBeenCalledTimes(1);
    });
  });
});