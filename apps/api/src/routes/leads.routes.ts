import { Router } from "express";

import { createLeadsController } from "../controllers/leads.controller.js";
import type { AppServices } from "../services/service-factory.js";

export function createLeadsRouter(services: AppServices): Router {
  const router = Router();
  const controller = createLeadsController(services);

  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.updateDiscovery);
  router.post("/:id/qualify", controller.qualify);
  router.post("/:id/whatsapp", controller.sendWhatsApp);
  return router;
}
