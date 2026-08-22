import { Router } from "express";

import { healthResponseSchema } from "@leadpilot/shared";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  const payload = healthResponseSchema.parse({
    status: "ok",
    service: "leadpilot-api",
    timestamp: new Date().toISOString(),
  });

  response.status(200).json(payload);
});
