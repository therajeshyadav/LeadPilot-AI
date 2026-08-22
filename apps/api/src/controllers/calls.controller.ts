import { z } from "zod";
import type { RequestHandler } from "express";
import { leadIdParamSchema } from "@leadpilot/shared";
import type { AppServices } from "../services/service-factory.js";
import { parseRequest } from "../utils/parse-request.js";

const outboundCallSchema = z.object({
  to: z.string().min(1, "Phone number required"),
  assistantId: z.string().min(1, "Assistant ID required"),
  metadata: z.record(z.string()).optional(),
});

const webhookCallEventSchema = z.object({
  eventId: z.string(),
  type: z.string(),
  providerCallId: z.string(),
  occurredAt: z.coerce.date(),
  transcript: z.string().optional(),
  detectedLanguage: z.enum(["ENGLISH", "HINDI", "TELUGU", "UNKNOWN"]).optional(),
  payload: z.unknown(),
});

export function createCallsController(services: AppServices): {
  createOutbound: RequestHandler;
  handleWebhook: RequestHandler;
  getCall: RequestHandler;
  listCalls: RequestHandler;
} {
  return {
    createOutbound: async (request, response) => {
      const { id: leadId } = parseRequest(leadIdParamSchema, request.params);
      const callData = parseRequest(outboundCallSchema, request.body);
      
      try {
        const call = await services.voice.createOutboundCall({
          ...callData,
          leadId
        });
        
        request.log.info(
          { event: "OUTBOUND_CALL_CREATED", leadId, callId: call.providerCallId },
          "Outbound call created"
        );
        
        response.status(201).json({ data: call });
      } catch (error) {
        if (error instanceof Error && error.message === "VOICE_PROVIDER_NOT_CONFIGURED") {
          response.status(501).json({ 
            error: "VOICE_PROVIDER_NOT_CONFIGURED",
            message: "Voice provider integration required for outbound calls" 
          });
        } else {
          throw error;
        }
      }
    },

    handleWebhook: async (request, response) => {
      try {
        await services.voice.handleWebhookEvent(
          Buffer.from(JSON.stringify(request.body)), 
          request.headers
        );
        
        request.log.info({ event: "VOICE_WEBHOOK_PROCESSED" }, "Voice webhook processed");
        response.status(200).json({ received: true });
      } catch (error) {
        if (error instanceof Error && error.message === "VOICE_PROVIDER_NOT_CONFIGURED") {
          response.status(501).json({ 
            error: "VOICE_PROVIDER_NOT_CONFIGURED",
            message: "Voice provider not configured" 
          });
        } else {
          request.log.error({ error: error instanceof Error ? error.message : "Unknown error" }, "Webhook processing failed");
          response.status(400).json({ error: "WEBHOOK_PROCESSING_FAILED" });
        }
      }
    },

    getCall: async (request, response) => {
      const { callId } = parseRequest(z.object({ callId: z.string() }), request.params);
      
      try {
        const call = await services.voice.getCall(callId);
        
        if (!call) {
          return response.status(404).json({ error: "CALL_NOT_FOUND" });
        }
        
        response.status(200).json({ data: call });
      } catch (error) {
        if (error instanceof Error && error.message === "VOICE_PROVIDER_NOT_CONFIGURED") {
          response.status(501).json({ 
            error: "VOICE_PROVIDER_NOT_CONFIGURED",
            message: "Voice provider integration required for call lookup" 
          });
        } else {
          throw error;
        }
      }
    },

    listCalls: async (request, response) => {
      const { id: leadId } = parseRequest(leadIdParamSchema, request.params);
      
      // Get conversations for this lead
      const conversations = await services.conversations.listForLead(leadId);
      
      response.status(200).json({ data: conversations });
    },
  };
}