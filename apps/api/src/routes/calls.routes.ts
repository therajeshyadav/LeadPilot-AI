import { Router } from "express";
import type { AppServices } from "../services/service-factory.js";
import { createCallsController } from "../controllers/calls.controller.js";

export function createCallsRouter(services: AppServices): Router {
  const router = Router({ mergeParams: true });
  const controller = createCallsController(services);

  // POST /api/leads/:id/calls/outbound
  router.post("/outbound", controller.createOutbound);
  
  // GET /api/leads/:id/calls
  router.get("/", controller.listCalls);
  
  // GET /api/calls/:callId  
  router.get("/:callId", controller.getCall);

  return router;
}

export function createWebhookRouter(services: AppServices): Router {
  const router = Router();
  const controller = createCallsController(services);

  // POST /api/webhooks/voice
  router.post("/voice", controller.handleWebhook);

  return router;
}