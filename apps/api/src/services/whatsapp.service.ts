import { randomUUID } from "node:crypto";

import type { SendWhatsAppInput } from "@leadpilot/shared";

import type { WhatsAppProvider } from "../integrations/whatsapp/whatsapp-provider.js";
import type { LeadRepository, WhatsAppMessageRepository } from "../repositories/contracts.js";
import type { WhatsAppMessageRecord } from "../types/domain.js";
import { IntegrationFailureError, NotFoundError, isAppError } from "../utils/errors.js";

export interface SendWhatsAppResult {
  message: WhatsAppMessageRecord;
  idempotent: boolean;
}

export class WhatsAppService {
  constructor(
    private readonly messages: WhatsAppMessageRepository,
    private readonly leads: LeadRepository,
    private readonly provider: WhatsAppProvider,
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

  async listForLead(leadId: string): Promise<WhatsAppMessageRecord[]> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw new NotFoundError("Lead");
    return this.messages.listForLead(leadId);
  }
}
