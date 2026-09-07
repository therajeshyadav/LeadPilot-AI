import { randomUUID } from "node:crypto";

import type { SendWhatsAppInput, SupportedLanguage } from "@leadpilot/shared";

import type { WhatsAppProvider } from "../integrations/whatsapp/whatsapp-provider.js";
import type { LeadIntelligenceProvider } from "../integrations/openai/lead-intelligence-provider.js";
import type { LeadRepository, WhatsAppMessageRepository } from "../repositories/contracts.js";
import type { LeadRecord, WhatsAppMessageRecord } from "../types/domain.js";
import { IntegrationFailureError, NotFoundError, isAppError } from "../utils/errors.js";

export interface SendWhatsAppResult {
  message: WhatsAppMessageRecord;
  idempotent: boolean;
}

export interface HotLeadWhatsAppInput {
  leadId: string;
  conversationId?: string;
  leadData: LeadRecord;
  transcript: string;
  discoveredInfo?: {
    budget?: string;
    productType?: string;
    timeline?: string;
    requirements?: string[];
  };
  language: SupportedLanguage;
  salesContactPhone?: string;
}

export class WhatsAppService {
  constructor(
    private readonly messages: WhatsAppMessageRepository,
    private readonly leads: LeadRepository,
    private readonly provider: WhatsAppProvider,
    private readonly intelligence?: LeadIntelligenceProvider,
  ) {}

  async send(leadId: string, input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw new NotFoundError("Lead");

    const idempotencyKey = input.idempotencyKey ?? randomUUID();
    const previous = await this.messages.findByIdempotencyKey(idempotencyKey);
    if (previous) return { message: previous, idempotent: true };

    const pending = await this.messages.create({
      leadId,
      conversationId: input.conversationId,
      type: input.type,
      message: input.message,
      idempotencyKey,
    });

    try {
      const result = input.mediaUrl
        ? await this.provider.sendMedia({ to: lead.phone, body: input.message, mediaUrl: input.mediaUrl, idempotencyKey })
        : await this.provider.sendText({ to: lead.phone, body: input.message, idempotencyKey });
      return { message: await this.messages.markSent(pending.id, result.providerMessageId), idempotent: false };
    } catch (error) {
      await this.messages.markFailed(pending.id);
      if (isAppError(error)) throw error;
      throw new IntegrationFailureError(this.provider.name, error);
    }
  }

  /**
   * CRITICAL: Send immediate WhatsApp when lead becomes HOT during live call
   * This must execute DURING the call, not after it ends
   * Messages are AI-generated based on actual conversation transcript
   */
  async sendHotLeadAlert(input: HotLeadWhatsAppInput): Promise<SendWhatsAppResult> {
    // Use conversation-based idempotency to prevent duplicate HOT alerts
    const idempotencyKey = input.conversationId 
      ? `hot_lead_${input.conversationId}`
      : `hot_lead_manual_${input.leadId}_${Date.now()}`;

    console.log(`🔍 Checking HOT lead WhatsApp idempotency - Key: ${idempotencyKey}`);
    
    const previous = await this.messages.findByIdempotencyKey(idempotencyKey);
    if (previous) {
      console.log(`⚠️ HOT lead WhatsApp already sent for lead ${input.leadId}, conversation ${input.conversationId}`);
      console.log(`   Previous message ID: ${previous.id}, Status: ${previous.sentAt ? 'SENT' : 'PENDING/FAILED'}, Provider Message ID: ${previous.providerMessageId || 'N/A'}`);
      return { message: previous, idempotent: true };
    }
    
    console.log(`✅ No previous HOT lead WhatsApp found, proceeding to send...`);
    console.log(`✅ No previous HOT lead WhatsApp found, proceeding to send...`);

    // Generate AI-based message from actual conversation
    console.log(`🤖 Generating HOT lead message using AI...`);
    const message = await this.generateHotLeadMessage(input);
    console.log(`✅ Generated HOT lead message (${message.length} chars): ${message.substring(0, 100)}...`);
    
    const pending = await this.messages.create({
      leadId: input.leadId,
      conversationId: input.conversationId,
      type: "HOT_LEAD",
      message,
      idempotencyKey,
    });

    try {
      console.log(`📤 Sending HOT lead WhatsApp to ${input.leadData.phone} for lead ${input.leadId}`);
      
      const result = await this.provider.sendText({ 
        to: input.leadData.phone, 
        body: message, 
        idempotencyKey 
      });

      const sent = await this.messages.markSent(pending.id, result.providerMessageId);
      
      console.log(`✅ HOT lead WhatsApp sent successfully!`);
      console.log(`   Message SID: ${result.providerMessageId}`);
      console.log(`   Lead: ${input.leadId}, Conversation: ${input.conversationId}`);
      return { message: sent, idempotent: false };
    } catch (error) {
      await this.messages.markFailed(pending.id);
      console.error(`❌ HOT lead WhatsApp failed for lead ${input.leadId}:`, error);
      
      if (isAppError(error)) throw error;
      throw new IntegrationFailureError(this.provider.name, error);
    }
  }

  /**
   * Send contextual follow-up after call completes using conversation transcript
   */
  async sendFollowUpMessage(input: {
    leadId: string;
    conversationId?: string;
    message: string;
    mediaUrls?: string[];
  }): Promise<SendWhatsAppResult> {
    const lead = await this.leads.findById(input.leadId);
    if (!lead) throw new NotFoundError("Lead");

    // Validate message is not empty
    if (!input.message || input.message.trim().length === 0) {
      const error = new Error("Follow-up message body cannot be empty");
      console.error("❌ WhatsApp send failed: empty message body");
      throw error;
    }

    const idempotencyKey = input.conversationId
      ? `followup_${input.conversationId}`
      : `followup_${input.leadId}_${Date.now()}`;

    const previous = await this.messages.findByIdempotencyKey(idempotencyKey);
    if (previous) return { message: previous, idempotent: true };

    console.log(`📤 Preparing to send follow-up WhatsApp to ${lead.phone}`);
    console.log(`   Message length: ${input.message.length} chars`);
    console.log(`   Media attachments: ${input.mediaUrls?.length || 0}`);

    const pending = await this.messages.create({
      leadId: input.leadId,
      conversationId: input.conversationId,
      type: "FOLLOW_UP",
      message: input.message,
      idempotencyKey,
    });

    try {
      let result;
      
      if (input.mediaUrls && input.mediaUrls.length > 0) {
        console.log(`📎 Sending message with media attachment: ${input.mediaUrls[0]}`);
        
        // Send first media with text
        result = await this.provider.sendMedia({ 
          to: lead.phone, 
          body: input.message, 
          mediaUrl: input.mediaUrls[0],
          idempotencyKey 
        });

        console.log(`✅ Primary message sent - SID: ${result.providerMessageId}`);

        // Send additional media files separately (without text to avoid duplication)
        for (let i = 1; i < input.mediaUrls.length; i++) {
          try {
            console.log(`📎 Sending additional media ${i}: ${input.mediaUrls[i]}`);
            const additionalResult = await this.provider.sendMedia({
              to: lead.phone,
              body: "", // Empty body for additional media
              mediaUrl: input.mediaUrls[i],
              idempotencyKey: `${idempotencyKey}_media_${i}`
            });
            console.log(`✅ Additional media ${i} sent - SID: ${additionalResult.providerMessageId}`);
          } catch (error) {
            console.warn(`⚠️ Failed to send additional media ${i}:`, error);
            // Continue even if additional media fails
          }
        }
      } else {
        console.log(`💬 Sending text-only message`);
        result = await this.provider.sendText({ 
          to: lead.phone, 
          body: input.message, 
          idempotencyKey 
        });
        console.log(`✅ Text message sent - SID: ${result.providerMessageId}`);
      }

      return { message: await this.messages.markSent(pending.id, result.providerMessageId), idempotent: false };
    } catch (error) {
      await this.messages.markFailed(pending.id);
      console.error(`❌ WhatsApp send failed:`, error);
      if (isAppError(error)) throw error;
      throw new IntegrationFailureError(this.provider.name, error);
    }
  }

  async listForLead(leadId: string): Promise<WhatsAppMessageRecord[]> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw new NotFoundError("Lead");
    return this.messages.listForLead(leadId);
  }

  /**
   * Generate AI-powered HOT lead message based on actual conversation
   */
  private async generateHotLeadMessage(input: HotLeadWhatsAppInput): Promise<string> {
    if (!this.intelligence) {
      // Fallback if AI not available
      return this.generateFallbackHotLeadMessage(input);
    }

    try {
      const message = await this.intelligence.generateHotLeadMessage({
        name: input.leadData.name ?? undefined,
        language: input.language,
        transcript: input.transcript,
        discoveredInfo: input.discoveredInfo
      });

      return message;
    } catch (error) {
      console.error("AI HOT lead message generation failed, using fallback:", error);
      return this.generateFallbackHotLeadMessage(input);
    }
  }

  /**
   * Fallback template-based message if AI fails
   */
  private generateFallbackHotLeadMessage(input: HotLeadWhatsAppInput): string {
    const { leadData, discoveredInfo, language, salesContactPhone } = input;
    
    const contactNumber = salesContactPhone || "+91-9876543210";
    const name = leadData.name || "Customer";

    if (language === "HINDI") {
      let message = `नमस्ते ${name}! 🙏\n\nआपकी e-commerce website की जरूरत को समझकर हमें खुशी हुई।`;
      
      if (discoveredInfo?.productType) {
        message += `\n\n📦 उत्पाद: ${discoveredInfo.productType}`;
      }
      
      if (discoveredInfo?.budget) {
        message += `\n💰 बजट: ${discoveredInfo.budget}`;
      }
      
      if (discoveredInfo?.timeline) {
        message += `\n⏰ लॉन्च: ${discoveredInfo.timeline}`;
      }

      if (discoveredInfo?.requirements && discoveredInfo.requirements.length > 0) {
        message += `\n\n✨ आवश्यकताएं: ${discoveredInfo.requirements.join(', ')}`;
      }

      message += `\n\nहम जल्दी ही detailed proposal share करेंगे।\n\n📞 Contact: ${contactNumber}\n\nTeam LeadPilot`;
      
      return message;
    }

    if (language === "TELUGU") {
      let message = `నమస్కారం ${name}! 🙏\n\nమీ e-commerce website అవసరాలను అర్థం చేసుకోవడంలో మేము సంతోషిస్తున్నాము।`;
      
      if (discoveredInfo?.productType) {
        message += `\n\n📦 ఉత్పత్తులు: ${discoveredInfo.productType}`;
      }
      
      if (discoveredInfo?.budget) {
        message += `\n💰 బడ్జెట్: ${discoveredInfo.budget}`;
      }
      
      if (discoveredInfo?.timeline) {
        message += `\n⏰ లాంచ్: ${discoveredInfo.timeline}`;
      }

      if (discoveredInfo?.requirements && discoveredInfo.requirements.length > 0) {
        message += `\n\n✨ అవసరాలు: ${discoveredInfo.requirements.join(', ')}`;
      }

      message += `\n\nమేము త్వరలో detailed proposal పంపుతాము।\n\n📞 Contact: ${contactNumber}\n\nTeam LeadPilot`;
      
      return message;
    }

    // Default English
    let message = `Hi ${name}! 👋\n\nGreat speaking with you about your e-commerce website needs.`;
    
    if (discoveredInfo?.productType) {
      message += `\n\n📦 Products: ${discoveredInfo.productType}`;
    }
    
    if (discoveredInfo?.budget) {
      message += `\n💰 Budget: ${discoveredInfo.budget}`;
    }
    
    if (discoveredInfo?.timeline) {
      message += `\n⏰ Timeline: ${discoveredInfo.timeline}`;
    }

    if (discoveredInfo?.requirements && discoveredInfo.requirements.length > 0) {
      message += `\n\n✨ Requirements: ${discoveredInfo.requirements.join(', ')}`;
    }

    message += `\n\nWe'll send you a detailed proposal shortly.\n\n📞 Contact: ${contactNumber}\n\nTeam LeadPilot`;
    
    return message;
  }
}
