import type {
  CallbackStatus,
  ConversationOutcome,
  ConversationRole,
  LeadQualification,
  LeadStatus,
  SupportedLanguage,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from "@leadpilot/shared";

export interface LeadRecord {
  id: string;
  name: string | null;
  phone: string;
  language: SupportedLanguage;
  leadStatus: LeadStatus;
  budget: string | null;
  productType: string | null;
  productCount: number | null;
  launchTimeline: string | null;
  requiredFeatures: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationRecord {
  id: string;
  leadId: string;
  providerCallId: string;
  startedAt: Date;
  endedAt: Date | null;
  duration: number | null;
  transcript: string | null;
  summary: string | null;
  detectedLanguage: SupportedLanguage;
  outcome: ConversationOutcome;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessageRecord {
  id: string;
  conversationId: string;
  role: ConversationRole;
  content: string;
  timestamp: Date;
}

export interface CallbackRecord {
  id: string;
  leadId: string;
  scheduledFor: Date;
  timezone: string;
  sourceText: string;
  status: CallbackStatus;
  calendarEventId: string | null;
  providerCallId: string | null;
  failureReason: string | null;
  triggeredAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppMessageRecord {
  id: string;
  leadId: string;
  conversationId: string | null;
  type: WhatsAppMessageType;
  message: string;
  status: WhatsAppMessageStatus;
  idempotencyKey: string;
  providerMessageId: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadQualificationRecord extends LeadQualification {
  id: string;
  leadId: string;
  conversationId: string | null;
  createdAt: Date;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
