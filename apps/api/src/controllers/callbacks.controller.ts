import { z } from "zod";
import { createCallbackSchema, leadIdParamSchema } from "@leadpilot/shared";
import type { RequestHandler } from "express";

import type { AppServices } from "../services/service-factory.js";
import { parseRequest } from "../utils/parse-request.js";

const listCallbacksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  leadId: z.string().cuid().optional(),
});

export function createCallbacksController(services: AppServices): { create: RequestHandler; list: RequestHandler } {
  return {
    create: async (request, response) => {
      const { id } = parseRequest(leadIdParamSchema, request.params);
      const result = await services.callbacks.schedule(id, parseRequest(createCallbackSchema, request.body));
      request.log.info({ event: "CALLBACK_CREATED", leadId: id, callbackId: result.callback.id, calendarSync: result.calendarSync }, "Callback created");
      response.status(201).json({ data: result.callback, calendarSync: result.calendarSync });
    },
    list: async (request, response) => {
      const result = await services.callbacks.list(parseRequest(listCallbacksQuerySchema, request.query));
      response.status(200).json({ data: result.items, page: { total: result.total, limit: result.limit, offset: result.offset } });
    },
  };
}
