import type { LeadQualification } from "@leadpilot/shared";

import type { ConversationRepository, LeadRepository, QualificationRepository } from "../repositories/contracts.js";
import type { LeadQualificationRecord } from "../types/domain.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";

export class QualificationService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly conversations: ConversationRepository,
    private readonly qualifications: QualificationRepository,
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

  async listForLead(leadId: string): Promise<LeadQualificationRecord[]> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw new NotFoundError("Lead");
    return this.qualifications.listForLead(leadId);
  }
}
