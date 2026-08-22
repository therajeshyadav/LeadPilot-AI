import type {
  CreateCallbackInput,
  CreateConversationInput,
  CreateLeadInput,
  FinishConversationInput,
  LeadQualification,
  LeadStatus,
  UpdateLeadDiscoveryInput,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from "@leadpilot/shared";

import type {
  CallbackRecord,
  ConversationMessageRecord,
  ConversationRecord,
  LeadQualificationRecord,
  LeadRecord,
  PaginatedResult,
  WhatsAppMessageRecord,
} from "../types/domain.js";

export interface LeadRepository {
  create(input: CreateLeadInput): Promise<LeadRecord>;
  findById(id: string): Promise<LeadRecord | null>;
  findByPhone(phone: string): Promise<LeadRecord | null>;
  list(input: { limit: number; offset: number; status?: LeadStatus }): Promise<PaginatedResult<LeadRecord>>;
  updateDiscovery(id: string, input: UpdateLeadDiscoveryInput): Promise<LeadRecord>;
  setStatus(id: string, status: LeadStatus): Promise<LeadRecord>;
}

export interface ConversationRepository {
  create(input: CreateConversationInput): Promise<ConversationRecord>;
  findById(id: string): Promise<ConversationRecord | null>;
  findByProviderCallId(providerCallId: string): Promise<ConversationRecord | null>;
  appendMessage(input: {
    conversationId: string;
    role: ConversationMessageRecord["role"];
    content: string;
    timestamp?: Date;
  }): Promise<ConversationMessageRecord>;
  listMessages(conversationId: string): Promise<ConversationMessageRecord[]>;
  finish(id: string, input: FinishConversationInput & { duration: number | null }): Promise<ConversationRecord>;
}

export interface CallbackRepository {
  create(input: CreateCallbackInput & { leadId: string }): Promise<CallbackRecord>;
  attachCalendarEvent(id: string, calendarEventId: string): Promise<CallbackRecord>;
  list(input: { limit: number; offset: number; leadId?: string }): Promise<PaginatedResult<CallbackRecord>>;
}

export interface WhatsAppMessageRepository {
  create(input: {
    leadId: string;
    conversationId?: string;
    type: WhatsAppMessageType;
    message: string;
    idempotencyKey: string;
  }): Promise<WhatsAppMessageRecord>;
  findByIdempotencyKey(idempotencyKey: string): Promise<WhatsAppMessageRecord | null>;
  markSent(id: string, providerMessageId: string): Promise<WhatsAppMessageRecord>;
  markFailed(id: string): Promise<WhatsAppMessageRecord>;
  listForLead(leadId: string): Promise<WhatsAppMessageRecord[]>;
}

export interface QualificationRepository {
  create(input: {
    leadId: string;
    conversationId?: string;
    qualification: LeadQualification;
  }): Promise<LeadQualificationRecord>;
  listForLead(leadId: string): Promise<LeadQualificationRecord[]>;
}

export interface Repositories {
  leads: LeadRepository;
  conversations: ConversationRepository;
  callbacks: CallbackRepository;
  whatsappMessages: WhatsAppMessageRepository;
  qualifications: QualificationRepository;
}
