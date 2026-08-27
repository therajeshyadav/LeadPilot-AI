import type { SupportedLanguage } from "@leadpilot/shared";
import type { LeadIntelligenceProvider } from "../integrations/openai/lead-intelligence-provider.js";
import type { VoiceProvider, OutboundCallRequest, VoiceCall, VoiceWebhookEvent } from "../integrations/voice/voice-provider.js";
import type { ConversationRepository, LeadRepository } from "../repositories/contracts.js";
import type { WhatsAppService } from "./whatsapp.service.js";
import type { CallbackService } from "./callback.service.js";

export class VoiceService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly leads: LeadRepository,
    private readonly voiceProvider?: VoiceProvider,
    private readonly intelligence?: LeadIntelligenceProvider,
    private readonly whatsapp?: WhatsAppService,
    private readonly callbacks?: CallbackService,
  ) {}

  async createOutboundCall(request: OutboundCallRequest): Promise<VoiceCall> {
    if (!this.voiceProvider) {
      throw new Error("VOICE_PROVIDER_NOT_CONFIGURED");
    }

    const call = await this.voiceProvider.createOutboundCall(request);
    
    // Create conversation record
    await this.conversations.create({
      leadId: request.leadId,
      providerCallId: call.providerCallId,
      startedAt: call.startedAt || new Date(),
      detectedLanguage: "UNKNOWN"
    });

    return call;
  }

  async handleWebhookEvent(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<void> {
    if (!this.voiceProvider) {
      throw new Error("VOICE_PROVIDER_NOT_CONFIGURED");
    }

    const event = await this.voiceProvider.parseAndVerifyWebhook(rawBody, headers);
    
    console.log(`📥 Webhook received: ${event.type} for call ${event.providerCallId}`);
    
    // Map Vapi event names to our internal event types
    const eventTypeMap: Record<string, string> = {
      'conversation-update': 'transcript_received',
      'speech-update': 'transcript_received',
      'end-of-call-report': 'call_ended',
      'status-update': 'call_ended',
      'hang': 'call_ended',
    };

    const mappedType = eventTypeMap[event.type] || event.type;
    
    // Find conversation by provider call ID
    const conversation = await this.conversations.findByProviderCallId(event.providerCallId);
    if (!conversation) {
      console.warn(`⚠️ No conversation found for call ID: ${event.providerCallId} (event: ${event.type})`);
      return;
    }

    console.log(`✅ Conversation found: ${conversation.id} for lead ${conversation.leadId}`);

    // Handle different event types
    switch (mappedType) {
      case "call_started":
        await this.handleCallStarted(conversation.id, event);
        break;
      case "transcript_received":
        await this.handleTranscriptReceived(conversation.id, event);
        break;
      case "call_ended":
        await this.handleCallEnded(conversation.id, event);
        break;
      default:
        console.log(`ℹ️ Unhandled voice event type: ${event.type} (mapped: ${mappedType})`);
    }
  }

  async getCall(providerCallId: string): Promise<VoiceCall | null> {
    if (!this.voiceProvider) {
      throw new Error("VOICE_PROVIDER_NOT_CONFIGURED");
    }

    return this.voiceProvider.getCall(providerCallId);
  }

  async endCall(providerCallId: string): Promise<void> {
    if (!this.voiceProvider) {
      throw new Error("VOICE_PROVIDER_NOT_CONFIGURED");
    }

    await this.voiceProvider.endCall(providerCallId);
  }

  private async handleCallStarted(conversationId: string, event: VoiceWebhookEvent): Promise<void> {
    await this.conversations.update(conversationId, {
      startedAt: event.occurredAt,
      outcome: "IN_PROGRESS"
    });

    console.log(`Call started: ${event.providerCallId}`);
  }

  private async handleTranscriptReceived(conversationId: string, event: VoiceWebhookEvent): Promise<void> {
    if (event.transcript) {
      const conversation = await this.conversations.findById(conversationId);
      if (!conversation) return;

      // Update conversation with transcript
      await this.conversations.update(conversationId, {
        transcript: event.transcript,
        detectedLanguage: event.detectedLanguage || "UNKNOWN"
      });

      // Detect language using AI if not already detected
      let detectedLanguage = event.detectedLanguage;
      if (this.intelligence && detectedLanguage === "UNKNOWN") {
        detectedLanguage = await this.intelligence.detectLanguage(event.transcript);
        await this.conversations.update(conversationId, {
          detectedLanguage
        });
      }

      // CRITICAL: Mid-call HOT lead detection and immediate WhatsApp
      if (this.intelligence && this.whatsapp && event.transcript.length > 100) {
        await this.checkForHotLeadAndSendWhatsApp(conversation.leadId, conversationId, event.transcript, detectedLanguage || "UNKNOWN");
      }

      // Detect callback intent and schedule if requested
      if (this.intelligence && this.callbacks && event.transcript.length > 50) {
        await this.checkForCallbackIntent(conversation.leadId, conversationId, event.transcript, detectedLanguage || "UNKNOWN");
      }

      console.log(`Transcript received for call: ${event.providerCallId}`);
    }
  }

  /**
   * Detect if customer wants a callback and schedule it automatically
   */
  private async checkForCallbackIntent(leadId: string, conversationId: string, transcript: string, language: SupportedLanguage): Promise<void> {
    if (!this.intelligence || !this.callbacks) return;

    try {
      const intent = await this.intelligence.detectCallbackIntent(transcript, language);

      if (!intent.requested) {
        return; // No callback requested
      }

      console.log(`📅 Callback requested for lead ${leadId}: ${intent.originalText}`);

      // Calculate scheduled date/time
      const scheduledFor = this.calculateCallbackDateTime(intent);
      const timezone = process.env.DEFAULT_TIMEZONE || "Asia/Kolkata";

      // Prevent scheduling in the past
      if (scheduledFor.getTime() <= Date.now()) {
        console.warn(`Callback date is in the past for lead ${leadId}, skipping`);
        return;
      }

      // Get lead for context
      const lead = await this.leads.findById(leadId);
      if (!lead) return;

      // Schedule the callback
      try {
        const result = await this.callbacks.schedule(leadId, {
          scheduledFor,
          timezone,
          sourceText: intent.originalText || transcript.slice(0, 200),
        });

        console.log(`✅ Callback scheduled for lead ${leadId} on ${scheduledFor.toISOString()} (${timezone})`);
        console.log(`   Calendar sync status: ${result.calendarSync}`);

      } catch (callbackError) {
        console.error(`❌ Failed to schedule callback for ${leadId}:`, callbackError);
        // Don't let callback scheduling failure disrupt the call
      }

    } catch (error) {
      console.error(`Error in callback intent detection for ${leadId}:`, error);
      // Don't let errors disrupt the call processing
    }
  }

  /**
   * Calculate callback date/time based on detected intent
   */
  private calculateCallbackDateTime(intent: import("../integrations/openai/lead-intelligence-provider.js").CallbackIntent): Date {
    const now = new Date();
    let targetDate = new Date(now);

    // Parse date if provided (YYYY-MM-DD format)
    if (intent.date) {
      const parsedDate = new Date(intent.date);
      if (!isNaN(parsedDate.getTime())) {
        targetDate = parsedDate;
      }
    }

    // Set time based on specificTime or timeOfDay
    if (intent.specificTime) {
      // Format: "HH:MM"
      const [hours, minutes] = intent.specificTime.split(':').map(Number);
      targetDate.setHours(hours, minutes, 0, 0);
    } else if (intent.timeOfDay) {
      // Use configured defaults for time of day
      const defaultHours = {
        morning: parseInt(process.env.DEFAULT_CALLBACK_MORNING_HOUR || "10", 10),
        afternoon: parseInt(process.env.DEFAULT_CALLBACK_AFTERNOON_HOUR || "15", 10),
        evening: parseInt(process.env.DEFAULT_CALLBACK_EVENING_HOUR || "18", 10),
        specific: parseInt(process.env.DEFAULT_CALLBACK_AFTERNOON_HOUR || "15", 10),
      };

      const hour = defaultHours[intent.timeOfDay];
      targetDate.setHours(hour, 0, 0, 0);
    } else {
      // Default to afternoon if no time specified
      const defaultHour = parseInt(process.env.DEFAULT_CALLBACK_AFTERNOON_HOUR || "15", 10);
      targetDate.setHours(defaultHour, 0, 0, 0);
    }

    return targetDate;
  }

  /**
   * CRITICAL: Check if lead is HOT during live call and send WhatsApp immediately
   */
  private async checkForHotLeadAndSendWhatsApp(leadId: string, conversationId: string, transcript: string, language: SupportedLanguage): Promise<void> {
    if (!this.intelligence || !this.whatsapp) return;

    try {
      const lead = await this.leads.findById(leadId);
      if (!lead) return;

      // Get current lead discovery data
      const currentLead = {
        budget: lead.budget || undefined,
        productType: lead.productType || undefined,
        productCount: lead.productCount || undefined,
        launchTimeline: lead.launchTimeline || undefined,
        requiredFeatures: lead.requiredFeatures || [],
        notes: lead.notes || undefined,
      };

      // Use AI to qualify the conversation in real-time
      const qualification = await this.intelligence.qualifyConversation({
        transcript,
        currentLead
      });

      console.log(`Lead qualification for ${leadId}: ${qualification.classification} (score: ${qualification.score})`);

      // If lead is HOT, send WhatsApp immediately (during live call!)
      if (qualification.classification === "HOT") {
        console.log(`🔥 HOT LEAD DETECTED during live call for lead ${leadId}, sending WhatsApp immediately`);

        // Extract latest discovery info from transcript
        const discoveredInfo = await this.intelligence.extractDiscovery(transcript);

        // Send immediate HOT lead WhatsApp
        try {
          const result = await this.whatsapp.sendHotLeadAlert({
            leadId,
            conversationId,
            leadData: lead,
            discoveredInfo: {
              budget: discoveredInfo.budget,
              productType: discoveredInfo.productType,
              timeline: discoveredInfo.launchTimeline,
              requirements: discoveredInfo.requiredFeatures,
            },
            language,
            salesContactPhone: process.env.SALES_CONTACT_PHONE,
          });

          if (result.idempotent) {
            console.log(`HOT lead WhatsApp already sent for conversation ${conversationId}`);
          } else {
            console.log(`✅ HOT lead WhatsApp sent successfully during live call: ${result.message.id}`);
          }

          // Update lead status to HOT
          await this.leads.setStatus(leadId, "HOT");

        } catch (whatsappError) {
          console.error(`❌ Failed to send HOT lead WhatsApp for ${leadId}:`, whatsappError);
          // Don't let WhatsApp failure disrupt the call
        }
      }
    } catch (error) {
      console.error(`Error in mid-call HOT lead detection for ${leadId}:`, error);
      // Don't let errors disrupt the call processing
    }
  }

  private async handleCallEnded(conversationId: string, event: VoiceWebhookEvent): Promise<void> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) return;

    // Update conversation with end details
    await this.conversations.update(conversationId, {
      endedAt: event.occurredAt,
      outcome: "COMPLETED",
      duration: conversation.startedAt 
        ? Math.floor((event.occurredAt.getTime() - conversation.startedAt.getTime()) / 1000)
        : undefined
    });

    // Trigger post-call processing if we have AI and transcript
    if (this.intelligence && conversation.transcript) {
      await this.processCallEnded(conversation.leadId, conversationId, conversation.transcript, conversation.detectedLanguage);
    }

    console.log(`Call ended: ${event.providerCallId}`);
  }

  private async processCallEnded(leadId: string, conversationId: string, transcript: string, language: SupportedLanguage): Promise<void> {
    if (!this.intelligence) return;

    try {
      // Extract discovery information
      const discovery = await this.intelligence.extractDiscovery(transcript);
      
      // Update lead with discovered information
      if (Object.keys(discovery).length > 0) {
        await this.leads.updateDiscovery(leadId, discovery);
      }

      // Send contextual follow-up WhatsApp using AI-generated message
      if (this.whatsapp) {
        const lead = await this.leads.findById(leadId);
        if (lead) {
          const followUpMessage = await this.intelligence.generateFollowUp({
            name: lead.name ?? undefined,
            language,
            transcript
          });

          // Prepare media URLs if available
          const mediaUrls = [];
          if (process.env.ARCHITECTURE_IMAGE_URL) {
            mediaUrls.push(process.env.ARCHITECTURE_IMAGE_URL);
          }
          if (process.env.RESUME_DOCUMENT_URL) {
            mediaUrls.push(process.env.RESUME_DOCUMENT_URL);
          }

          try {
            await this.whatsapp.sendFollowUpMessage({
              leadId,
              conversationId,
              message: followUpMessage,
              mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
            });

            console.log(`📱 Post-call follow-up WhatsApp sent for lead ${leadId}`);
          } catch (followUpError) {
            console.error(`Failed to send post-call follow-up WhatsApp for ${leadId}:`, followUpError);
          }
        }
      }

      console.log(`Post-call processing completed for lead: ${leadId}`);
    } catch (error) {
      console.error("Post-call processing failed:", error);
    }
  }
}