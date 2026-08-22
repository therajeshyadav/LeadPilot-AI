import { z } from "zod";
import {
  createLeadSchema,
  leadIdParamSchema,
  leadStatusSchema,
  recordQualificationSchema,
  sendWhatsAppSchema,
  updateLeadDiscoverySchema,
} from "@leadpilot/shared";
import type { RequestHandler } from "express";

import type { AppServices } from "../services/service-factory.js";
import { parseRequest } from "../utils/parse-request.js";

const listLeadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: leadStatusSchema.optional(),
});

export function createLeadsController(services: AppServices): {
  create: RequestHandler;
  list: RequestHandler;
  get: RequestHandler;
  updateDiscovery: RequestHandler;
  qualify: RequestHandler;
  sendWhatsApp: RequestHandler;
} {
  return {
    create: async (request, response) => {
      const lead = await services.leads.create(parseRequest(createLeadSchema, request.body));
      request.log.info({ event: "LEAD_CREATED", leadId: lead.id }, "Lead created");
      response.status(201).json({ data: lead });
    },
    list: async (request, response) => {
      const result = await services.leads.list(parseRequest(listLeadsQuerySchema, request.query));
      response.status(200).json({ data: result.items, page: { total: result.total, limit: result.limit, offset: result.offset } });
    },
    get: async (request, response) => {
      const { id } = parseRequest(leadIdParamSchema, request.params);
      const lead = await services.leads.get(id);
      const [qualifications, whatsappMessages] = await Promise.all([
        services.qualifications.listForLead(id),
        services.whatsapp.listForLead(id),
      ]);
      response.status(200).json({ data: { ...lead, qualifications, whatsappMessages } });
    },
    updateDiscovery: async (request, response) => {
      const { id } = parseRequest(leadIdParamSchema, request.params);
      const lead = await services.leads.updateDiscovery(id, parseRequest(updateLeadDiscoverySchema, request.body));
      request.log.info({ event: "DISCOVERY_UPDATED", leadId: lead.id }, "Lead discovery updated");
      response.status(200).json({ data: lead });
    },
    qualify: async (request, response) => {
      const { id } = parseRequest(leadIdParamSchema, request.params);
      const { conversationId, ...qualification } = parseRequest(recordQualificationSchema, request.body);
      const result = await services.qualifications.record({ leadId: id, conversationId, qualification });
      request.log.info(
        { event: "LEAD_QUALIFIED", leadId: id, conversationId, classification: result.classification, score: result.score },
        "Lead qualification recorded",
      );
      response.status(201).json({ data: result });
    },
    sendWhatsApp: async (request, response) => {
      const { id } = parseRequest(leadIdParamSchema, request.params);
      const idempotencyKey = request.get("idempotency-key") ?? undefined;
      const body = parseRequest(sendWhatsAppSchema, { ...request.body, idempotencyKey: request.body?.idempotencyKey ?? idempotencyKey });
      const result = await services.whatsapp.send(id, body);
      request.log.info(
        { event: "WHATSAPP_SEND_REQUESTED", leadId: id, conversationId: body.conversationId, messageId: result.message.id, idempotent: result.idempotent },
        "WhatsApp send processed",
      );
      response.status(result.idempotent ? 200 : 201).json({ data: result.message, idempotent: result.idempotent });
    },
  };
}
