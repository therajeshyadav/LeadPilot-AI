import type {
  ConversationMessageInput,
  CreateConversationInput,
  FinishConversationInput,
} from "@leadpilot/shared";

import type { ConversationRepository, LeadRepository } from "../repositories/contracts.js";
import type { ConversationMessageRecord, ConversationRecord } from "../types/domain.js";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors.js";

export class ConversationService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly leads: LeadRepository,
  ) {}

  async start(input: CreateConversationInput): Promise<ConversationRecord> {
    const lead = await this.leads.findById(input.leadId);
    if (!lead) throw new NotFoundError("Lead");

    const existing = await this.conversations.findByProviderCallId(input.providerCallId);
    if (existing) throw new ConflictError("A conversation already exists for this provider call.");

    return this.conversations.create(input);
  }

  async get(id: string): Promise<ConversationRecord> {
    const conversation = await this.conversations.findById(id);
    if (!conversation) throw new NotFoundError("Conversation");
    return conversation;
  }

  async getWithMessages(id: string): Promise<{ conversation: ConversationRecord; messages: ConversationMessageRecord[] }> {
    const conversation = await this.get(id);
    return { conversation, messages: await this.conversations.listMessages(id) };
  }

  async appendMessage(id: string, input: ConversationMessageInput): Promise<ConversationMessageRecord> {
    await this.get(id);
    return this.conversations.appendMessage({ conversationId: id, ...input });
  }

  async finish(id: string, input: FinishConversationInput): Promise<ConversationRecord> {
    const conversation = await this.get(id);
    const endedAt = input.endedAt ?? new Date();
    if (endedAt.getTime() < conversation.startedAt.getTime()) {
      throw new ValidationError("Conversation end time cannot be before its start time.");
    }

    const duration = Math.floor((endedAt.getTime() - conversation.startedAt.getTime()) / 1_000);
    return this.conversations.finish(id, { ...input, endedAt, duration });
  }

  async listForLead(leadId: string): Promise<ConversationRecord[]> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw new NotFoundError("Lead");
    
    // This would require a new repository method - for now return empty array
    // TODO: Implement listByLeadId in ConversationRepository
    return [];
  }
}
