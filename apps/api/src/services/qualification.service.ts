import type { LeadQualification } from "@leadpilot/shared";

import type { LeadIntelligenceProvider } from "../integrations/openai/lead-intelligence-provider.js";
import type { ConversationRepository, LeadRepository, QualificationRepository } from "../repositories/contracts.js";
import type { LeadQualificationRecord } from "../types/domain.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";

export class QualificationService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly conversations: ConversationRepository,
    private readonly qualifications: QualificationRepository,
    private readonly intelligence?: LeadIntelligenceProvider,
  ) {}

  async record(input: {
    leadId: string;
    conversationId?: string;
    qualification: LeadQualification;
  }): Promise<LeadQualificationRecord> {
    const lead = await this.leads.findById(input.leadId);
    if (!lead) throw new NotFoundError("Lead");

    if (input.conversationId) {
      const conversation = await this.conversations.findById(input.conversationId);
      if (!conversation) throw new NotFoundError("Conversation");
      if (conversation.leadId !== lead.id) {
        throw new ValidationError("The conversation does not belong to this lead.");
      }
    }

    const record = await this.qualifications.create(input);
    await this.leads.setStatus(lead.id, record.classification);
    return record;
  }

  async qualifyFromConversation(conversationId: string): Promise<LeadQualificationRecord | null> {
    if (!this.intelligence) {
      throw new Error("AI_PROVIDER_NOT_CONFIGURED");
    }

    const conversation = await this.conversations.findById(conversationId);
    if (!conversation || !conversation.transcript) {
      return null;
    }

    const lead = await this.leads.findById(conversation.leadId);
    if (!lead) {
      throw new NotFoundError("Lead");
    }

    // Use AI to qualify the conversation
    const qualification = await this.intelligence.qualifyConversation({
      transcript: conversation.transcript,
      currentLead: {
        budget: lead.budget || undefined,
        productType: lead.productType || undefined,
        productCount: lead.productCount || undefined,
        launchTimeline: lead.launchTimeline || undefined,
        requiredFeatures: lead.requiredFeatures || [],
        notes: lead.notes || undefined,
      }
    });

    // Record the qualification
    return this.record({
      leadId: conversation.leadId,
      conversationId,
      qualification
    });
  }

  async listForLead(leadId: string): Promise<LeadQualificationRecord[]> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw new NotFoundError("Lead");
    return this.qualifications.listForLead(leadId);
  }
}
