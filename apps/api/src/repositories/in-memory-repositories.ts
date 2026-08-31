import type {
  CreateCallbackInput,
  CreateConversationInput,
  CreateLeadInput,
  FinishConversationInput,
  LeadQualification,
  LeadStatus,
  UpdateLeadDiscoveryInput,
  WhatsAppMessageType,
} from "@leadpilot/shared";

import { ConflictError } from "../utils/errors.js";
import type {
  CallbackRecord,
  ConversationMessageRecord,
  ConversationRecord,
  LeadQualificationRecord,
  LeadRecord,
  PaginatedResult,
  WhatsAppMessageRecord,
} from "../types/domain.js";
import type {
  CallbackRepository,
  ConversationRepository,
  LeadRepository,
  QualificationRepository,
  Repositories,
  WhatsAppMessageRepository,
} from "./contracts.js";

let sequence = 0;

function newId(): string {
  sequence += 1;
  return `c${sequence.toString(36).padStart(24, "0")}`;
}

function now(): Date {
  return new Date();
}

function paginate<T>(items: T[], limit: number, offset: number): PaginatedResult<T> {
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}

export class InMemoryLeadRepository implements LeadRepository {
  private readonly records = new Map<string, LeadRecord>();

  async create(input: CreateLeadInput): Promise<LeadRecord> {
    if (await this.findByPhone(input.phone)) {
      throw new ConflictError("A lead with this phone number already exists.");
    }

    const timestamp = now();
    const record: LeadRecord = {
      id: newId(),
      name: input.name ?? null,
      phone: input.phone,
      language: input.language ?? "UNKNOWN",
      leadStatus: "UNQUALIFIED",
      budget: input.budget ?? null,
      productType: input.productType ?? null,
      productCount: input.productCount ?? null,
      launchTimeline: input.launchTimeline ?? null,
      requiredFeatures: input.requiredFeatures ?? [],
      notes: input.notes ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<LeadRecord | null> {
    return this.records.get(id) ?? null;
  }

  async findByPhone(phone: string): Promise<LeadRecord | null> {
    return [...this.records.values()].find((lead) => lead.phone === phone) ?? null;
  }

  async list(input: { limit: number; offset: number; status?: LeadStatus }): Promise<PaginatedResult<LeadRecord>> {
    const records = [...this.records.values()]
      .filter((lead) => !input.status || lead.leadStatus === input.status)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    return paginate(records, input.limit, input.offset);
  }

  async updateDiscovery(id: string, input: UpdateLeadDiscoveryInput): Promise<LeadRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error("Lead does not exist.");
    const updated: LeadRecord = {
      ...existing,
      ...input,
      requiredFeatures: input.requiredFeatures ?? existing.requiredFeatures,
      updatedAt: now(),
    };
    this.records.set(id, updated);
    return updated;
  }

  async setStatus(id: string, leadStatus: LeadStatus): Promise<LeadRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error("Lead does not exist.");
    const updated = { ...existing, leadStatus, updatedAt: now() };
    this.records.set(id, updated);
    return updated;
  }
}

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly records = new Map<string, ConversationRecord>();
  private readonly messages = new Map<string, ConversationMessageRecord[]>();

  async create(input: CreateConversationInput): Promise<ConversationRecord> {
    if (await this.findByProviderCallId(input.providerCallId)) {
      throw new ConflictError("A conversation already exists for this provider call.");
    }
    const timestamp = now();
    const record: ConversationRecord = {
      id: newId(),
      leadId: input.leadId,
      providerCallId: input.providerCallId,
      startedAt: input.startedAt ?? timestamp,
      endedAt: null,
      duration: null,
      transcript: null,
      summary: null,
      detectedLanguage: input.detectedLanguage ?? "UNKNOWN",
      outcome: "IN_PROGRESS",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    return this.records.get(id) ?? null;
  }

  async findByProviderCallId(providerCallId: string): Promise<ConversationRecord | null> {
    return [...this.records.values()].find((conversation) => conversation.providerCallId === providerCallId) ?? null;
  }

  async update(id: string, input: Partial<ConversationRecord>): Promise<ConversationRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error(`Conversation ${id} not found`);
    
    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };
    
    this.records.set(id, updated);
    return updated;
  }

  async appendMessage(input: {
    conversationId: string;
    role: ConversationMessageRecord["role"];
    content: string;
    timestamp?: Date;
  }): Promise<ConversationMessageRecord> {
    const message: ConversationMessageRecord = {
      id: newId(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      timestamp: input.timestamp ?? now(),
    };
    this.messages.set(input.conversationId, [...(this.messages.get(input.conversationId) ?? []), message]);
    return message;
  }

  async listMessages(conversationId: string): Promise<ConversationMessageRecord[]> {
    return this.messages.get(conversationId) ?? [];
  }

  async finish(id: string, input: FinishConversationInput & { duration: number | null }): Promise<ConversationRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error("Conversation does not exist.");
    const updated: ConversationRecord = {
      ...existing,
      endedAt: input.endedAt ?? now(),
      duration: input.duration,
      transcript: input.transcript ?? existing.transcript,
      summary: input.summary ?? existing.summary,
      outcome: input.outcome,
      detectedLanguage: input.detectedLanguage ?? existing.detectedLanguage,
      updatedAt: now(),
    };
    this.records.set(id, updated);
    return updated;
  }
}

export class InMemoryCallbackRepository implements CallbackRepository {
  private readonly records = new Map<string, CallbackRecord>();

  async create(input: CreateCallbackInput & { leadId: string }): Promise<CallbackRecord> {
    const timestamp = now();
    const record: CallbackRecord = {
      id: newId(),
      leadId: input.leadId,
      scheduledFor: input.scheduledFor,
      timezone: input.timezone,
      sourceText: input.sourceText,
      status: "SCHEDULED",
      calendarEventId: null,
      providerCallId: null,
      failureReason: null,
      triggeredAt: null,
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.set(record.id, record);
    return record;
  }

  async attachCalendarEvent(id: string, calendarEventId: string): Promise<CallbackRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error("Callback does not exist.");
    const updated = { ...existing, calendarEventId, updatedAt: now() };
    this.records.set(id, updated);
    return updated;
  }

  async list(input: { limit: number; offset: number; leadId?: string }): Promise<PaginatedResult<CallbackRecord>> {
    const records = [...this.records.values()]
      .filter((callback) => !input.leadId || callback.leadId === input.leadId)
      .sort((left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime());
    return paginate(records, input.limit, input.offset);
  }

  async findPendingCallbacks(cutoffTime: Date): Promise<CallbackRecord[]> {
    return [...this.records.values()]
      .filter((callback) => callback.status === "SCHEDULED" && callback.scheduledFor <= cutoffTime)
      .sort((left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime());
  }

  async findByProviderCallId(providerCallId: string): Promise<CallbackRecord | null> {
    return [...this.records.values()].find((callback) => callback.providerCallId === providerCallId) ?? null;
  }

  async markAsProcessing(id: string, providerCallId: string): Promise<CallbackRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error("Callback does not exist.");
    const updated = { 
      ...existing, 
      status: "PROCESSING" as const, 
      providerCallId,
      triggeredAt: now(),
      updatedAt: now() 
    };
    this.records.set(id, updated);
    return updated;
  }

  async markAsCompleted(id: string): Promise<CallbackRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error("Callback does not exist.");
    const updated = { 
      ...existing, 
      status: "COMPLETED" as const,
      completedAt: now(),
      updatedAt: now() 
    };
    this.records.set(id, updated);
    return updated;
  }

  async markAsFailed(id: string, reason: string): Promise<CallbackRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error("Callback does not exist.");
    const updated = { 
      ...existing, 
      status: "FAILED" as const,
      failureReason: reason,
      updatedAt: now() 
    };
    this.records.set(id, updated);
    return updated;
  }
}

export class InMemoryWhatsAppMessageRepository implements WhatsAppMessageRepository {
  private readonly records = new Map<string, WhatsAppMessageRecord>();

  async create(input: {
    leadId: string;
    conversationId?: string;
    type: WhatsAppMessageType;
    message: string;
    idempotencyKey: string;
  }): Promise<WhatsAppMessageRecord> {
    if (await this.findByIdempotencyKey(input.idempotencyKey)) {
      throw new ConflictError("A WhatsApp message already exists for this idempotency key.");
    }
    const timestamp = now();
    const record: WhatsAppMessageRecord = {
      id: newId(),
      leadId: input.leadId,
      conversationId: input.conversationId ?? null,
      type: input.type,
      message: input.message,
      status: "PENDING",
      idempotencyKey: input.idempotencyKey,
      providerMessageId: null,
      sentAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.set(record.id, record);
    return record;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<WhatsAppMessageRecord | null> {
    return [...this.records.values()].find((message) => message.idempotencyKey === idempotencyKey) ?? null;
  }

  async markSent(id: string, providerMessageId: string): Promise<WhatsAppMessageRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error("WhatsApp message does not exist.");
    const timestamp = now();
    const updated = { ...existing, status: "SENT" as const, providerMessageId, sentAt: timestamp, updatedAt: timestamp };
    this.records.set(id, updated);
    return updated;
  }

  async markFailed(id: string): Promise<WhatsAppMessageRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error("WhatsApp message does not exist.");
    const updated = { ...existing, status: "FAILED" as const, updatedAt: now() };
    this.records.set(id, updated);
    return updated;
  }

  async listForLead(leadId: string): Promise<WhatsAppMessageRecord[]> {
    return [...this.records.values()]
      .filter((message) => message.leadId === leadId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }
}

export class InMemoryQualificationRepository implements QualificationRepository {
  private readonly records = new Map<string, LeadQualificationRecord>();

  async create(input: {
    leadId: string;
    conversationId?: string;
    qualification: LeadQualification;
  }): Promise<LeadQualificationRecord> {
    const record: LeadQualificationRecord = {
      id: newId(),
      leadId: input.leadId,
      conversationId: input.conversationId ?? null,
      ...input.qualification,
      createdAt: now(),
    };
    this.records.set(record.id, record);
    return record;
  }

  async listForLead(leadId: string): Promise<LeadQualificationRecord[]> {
    return [...this.records.values()]
      .filter((qualification) => qualification.leadId === leadId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}

export function createInMemoryRepositories(): Repositories {
  return {
    leads: new InMemoryLeadRepository(),
    conversations: new InMemoryConversationRepository(),
    callbacks: new InMemoryCallbackRepository(),
    whatsappMessages: new InMemoryWhatsAppMessageRepository(),
    qualifications: new InMemoryQualificationRepository(),
  };
}
