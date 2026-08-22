import { Prisma, PrismaClient } from "@prisma/client";

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

const asLead = (record: unknown) => record as LeadRecord;
const asConversation = (record: unknown) => record as ConversationRecord;
const asMessage = (record: unknown) => record as ConversationMessageRecord;
const asCallback = (record: unknown) => record as CallbackRecord;
const asWhatsAppMessage = (record: unknown) => record as WhatsAppMessageRecord;
const asQualification = (record: unknown) => record as LeadQualificationRecord;

class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateLeadInput): Promise<LeadRecord> {
    return asLead(
      await this.db.lead.create({
        data: {
          ...input,
          language: input.language ?? "UNKNOWN",
          requiredFeatures: input.requiredFeatures ?? [],
        },
      }),
    );
  }

  async findById(id: string): Promise<LeadRecord | null> {
    const result = await this.db.lead.findUnique({ where: { id } });
    return result ? asLead(result) : null;
  }

  async findByPhone(phone: string): Promise<LeadRecord | null> {
    const result = await this.db.lead.findUnique({ where: { phone } });
    return result ? asLead(result) : null;
  }

  async list(input: { limit: number; offset: number; status?: LeadStatus }): Promise<PaginatedResult<LeadRecord>> {
    const where = input.status ? { leadStatus: input.status } : undefined;
    const [records, total] = await this.db.$transaction([
      this.db.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: input.limit, skip: input.offset }),
      this.db.lead.count({ where }),
    ]);
    return { items: records.map(asLead), total, limit: input.limit, offset: input.offset };
  }

  async updateDiscovery(id: string, input: UpdateLeadDiscoveryInput): Promise<LeadRecord> {
    return asLead(await this.db.lead.update({ where: { id }, data: input }));
  }

  async setStatus(id: string, leadStatus: LeadStatus): Promise<LeadRecord> {
    return asLead(await this.db.lead.update({ where: { id }, data: { leadStatus } }));
  }
}

class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateConversationInput): Promise<ConversationRecord> {
    return asConversation(
      await this.db.conversation.create({
        data: {
          leadId: input.leadId,
          providerCallId: input.providerCallId,
          startedAt: input.startedAt,
          detectedLanguage: input.detectedLanguage ?? "UNKNOWN",
        },
      }),
    );
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    const result = await this.db.conversation.findUnique({ where: { id } });
    return result ? asConversation(result) : null;
  }

  async findByProviderCallId(providerCallId: string): Promise<ConversationRecord | null> {
    const result = await this.db.conversation.findUnique({ where: { providerCallId } });
    return result ? asConversation(result) : null;
  }

  async update(id: string, input: Partial<ConversationRecord>): Promise<ConversationRecord> {
    return asConversation(
      await this.db.conversation.update({
        where: { id },
        data: {
          transcript: input.transcript,
          detectedLanguage: input.detectedLanguage,
          outcome: input.outcome,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          duration: input.duration,
          summary: input.summary,
        },
      }),
    );
  }

  async appendMessage(input: {
    conversationId: string;
    role: ConversationMessageRecord["role"];
    content: string;
    timestamp?: Date;
  }): Promise<ConversationMessageRecord> {
    return asMessage(
      await this.db.conversationMessage.create({
        data: {
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          timestamp: input.timestamp,
        },
      }),
    );
  }

  async listMessages(conversationId: string): Promise<ConversationMessageRecord[]> {
    const records = await this.db.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { timestamp: "asc" },
    });
    return records.map(asMessage);
  }

  async finish(id: string, input: FinishConversationInput & { duration: number | null }): Promise<ConversationRecord> {
    return asConversation(
      await this.db.conversation.update({
        where: { id },
        data: {
          endedAt: input.endedAt ?? new Date(),
          duration: input.duration,
          transcript: input.transcript,
          summary: input.summary,
          outcome: input.outcome,
          detectedLanguage: input.detectedLanguage,
        },
      }),
    );
  }
}

class PrismaCallbackRepository implements CallbackRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateCallbackInput & { leadId: string }): Promise<CallbackRecord> {
    return asCallback(
      await this.db.callback.create({
        data: {
          leadId: input.leadId,
          scheduledFor: input.scheduledFor,
          timezone: input.timezone,
          sourceText: input.sourceText,
        },
      }),
    );
  }

  async attachCalendarEvent(id: string, calendarEventId: string): Promise<CallbackRecord> {
    return asCallback(await this.db.callback.update({ where: { id }, data: { calendarEventId } }));
  }

  async list(input: { limit: number; offset: number; leadId?: string }): Promise<PaginatedResult<CallbackRecord>> {
    const where = input.leadId ? { leadId: input.leadId } : undefined;
    const [records, total] = await this.db.$transaction([
      this.db.callback.findMany({ where, orderBy: { scheduledFor: "asc" }, take: input.limit, skip: input.offset }),
      this.db.callback.count({ where }),
    ]);
    return { items: records.map(asCallback), total, limit: input.limit, offset: input.offset };
  }
}

class PrismaWhatsAppMessageRepository implements WhatsAppMessageRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: {
    leadId: string;
    conversationId?: string;
    type: WhatsAppMessageType;
    message: string;
    idempotencyKey: string;
  }): Promise<WhatsAppMessageRecord> {
    return asWhatsAppMessage(
      await this.db.whatsAppMessage.create({
        data: {
          leadId: input.leadId,
          conversationId: input.conversationId,
          type: input.type,
          message: input.message,
          idempotencyKey: input.idempotencyKey,
        },
      }),
    );
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<WhatsAppMessageRecord | null> {
    const result = await this.db.whatsAppMessage.findUnique({ where: { idempotencyKey } });
    return result ? asWhatsAppMessage(result) : null;
  }

  async markSent(id: string, providerMessageId: string): Promise<WhatsAppMessageRecord> {
    return asWhatsAppMessage(
      await this.db.whatsAppMessage.update({
        where: { id },
        data: { status: "SENT", providerMessageId, sentAt: new Date() },
      }),
    );
  }

  async markFailed(id: string): Promise<WhatsAppMessageRecord> {
    return asWhatsAppMessage(await this.db.whatsAppMessage.update({ where: { id }, data: { status: "FAILED" } }));
  }

  async listForLead(leadId: string): Promise<WhatsAppMessageRecord[]> {
    const records = await this.db.whatsAppMessage.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } });
    return records.map(asWhatsAppMessage);
  }
}

class PrismaQualificationRepository implements QualificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: {
    leadId: string;
    conversationId?: string;
    qualification: LeadQualification;
  }): Promise<LeadQualificationRecord> {
    return asQualification(
      await this.db.leadQualification.create({
        data: {
          leadId: input.leadId,
          conversationId: input.conversationId,
          classification: input.qualification.classification,
          score: input.qualification.score,
          reasoning: input.qualification.reasoning,
          signals: input.qualification.signals as any,
        },
      }),
    );
  }

  async listForLead(leadId: string): Promise<LeadQualificationRecord[]> {
    const records = await this.db.leadQualification.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } });
    return records.map(asQualification);
  }
}

export function createPrismaRepositories(databaseUrl: string): { repositories: Repositories; prisma: PrismaClient } {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  return {
    prisma,
    repositories: {
      leads: new PrismaLeadRepository(prisma),
      conversations: new PrismaConversationRepository(prisma),
      callbacks: new PrismaCallbackRepository(prisma),
      whatsappMessages: new PrismaWhatsAppMessageRepository(prisma),
      qualifications: new PrismaQualificationRepository(prisma),
    },
  };
}
