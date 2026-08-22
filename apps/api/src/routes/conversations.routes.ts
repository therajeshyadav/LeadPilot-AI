import { Router } from "express";

import { createConversationsController } from "../controllers/conversations.controller.js";
import type { AppServices } from "../services/service-factory.js";

export function createConversationsRouter(services: AppServices): Router {
  const router = Router();
  const controller = createConversationsController(services);

  router.get("/:id", controller.get);
  return router;
}
