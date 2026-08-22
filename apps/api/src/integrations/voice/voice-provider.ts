import type { SupportedLanguage } from "@leadpilot/shared";

export interface OutboundCallRequest {
  to: string;
  from?: string;
  leadId: string;
  assistantId: string;
  metadata?: Record<string, string>;
}

export interface VoiceCall {
  providerCallId: string;
  status: string;
  to: string;
  startedAt?: Date;
}

export interface VoiceWebhookEvent {
  eventId: string;
  type: string;
  providerCallId: string;
  occurredAt: Date;
  transcript?: string;
  detectedLanguage?: SupportedLanguage;
  payload: unknown;
}

/** A provider adapter must verify its native webhook signature before returning an event. */
export interface VoiceProvider {
  readonly name: string;
  createOutboundCall(request: OutboundCallRequest): Promise<VoiceCall>;
  endCall(providerCallId: string): Promise<void>;
  getCall(providerCallId: string): Promise<VoiceCall | null>;
  parseAndVerifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<VoiceWebhookEvent>;
}
