import { conversationIdParamSchema } from "@leadpilot/shared";
import type { RequestHandler } from "express";

import type { AppServices } from "../services/service-factory.js";
import { parseRequest } from "../utils/parse-request.js";

export function createConversationsController(services: AppServices): { get: RequestHandler } {
  return {
    get: async (request, response) => {
      const { id } = parseRequest(conversationIdParamSchema, request.params);
      const result = await services.conversations.getWithMessages(id);
      response.status(200).json({ data: result });
    },
  };
}
