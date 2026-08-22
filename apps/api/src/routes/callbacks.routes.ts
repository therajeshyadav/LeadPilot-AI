import { Router } from "express";

import { createCallbacksController } from "../controllers/callbacks.controller.js";
import type { AppServices } from "../services/service-factory.js";

export function createCallbacksRouter(services: AppServices): Router {
  const router = Router();
  const controller = createCallbacksController(services);

  router.get("/", controller.list);
  return router;
}
