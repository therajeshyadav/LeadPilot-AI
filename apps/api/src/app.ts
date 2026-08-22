import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pino from "pino";
import { pinoHttp } from "pino-http";

import type { AppConfig } from "./config/env.js";
import { createCallbacksController } from "./controllers/callbacks.controller.js";
import { OpenAIIntelligenceProvider } from "./integrations/openai/openai-intelligence-provider.js";
import { UnavailableIntelligenceProvider } from "./integrations/openai/unavailable-intelligence-provider.js";
import { UnavailableVoiceProvider } from "./integrations/voice/unavailable-voice-provider.js";
import { VapiProvider } from "./integrations/voice/vapi-provider.js";
import { UnavailableWhatsAppProvider } from "./integrations/whatsapp/unavailable-whatsapp-provider.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createUnavailableRepositories } from "./repositories/unavailable-repositories.js";
import { createServices, type AppServices } from "./services/service-factory.js";
import { createCallbacksRouter } from "./routes/callbacks.routes.js";
import { createCallsRouter, createWebhookRouter } from "./routes/calls.routes.js";
import { createConversationsRouter } from "./routes/conversations.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { createLeadsRouter } from "./routes/leads.routes.js";

function createUnavailableServices(): AppServices {
  return createServices({
    repositories: createUnavailableRepositories(),
    whatsappProvider: new UnavailableWhatsAppProvider(),
    voiceProvider: new UnavailableVoiceProvider(),
    intelligenceProvider: new UnavailableIntelligenceProvider(),
  });
}

export function createApp(config: AppConfig, services: AppServices = createUnavailableServices()) {
  const app = express();
  const logger = pino({ level: config.LOG_LEVEL });

  app.disable("x-powered-by");
  app.use(pinoHttp({ logger, redact: ["req.headers.authorization", "req.headers['x-api-key']"] }));
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  app.use(express.json({ limit: "256kb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));

  app.use("/api", healthRouter);
  app.use("/api/leads", createLeadsRouter(services));
  app.use("/api/leads/:id/calls", createCallsRouter(services));
  app.use("/api/leads/:id/callback", createCallbacksControllerRouter(services));
  app.use("/api/callbacks", createCallbacksRouter(services));
  app.use("/api/conversations", createConversationsRouter(services));
  app.use("/api/webhooks", createWebhookRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function createCallbacksControllerRouter(services: AppServices) {
  const router = express.Router({ mergeParams: true });
  router.post("/", createCallbacksController(services).create);
  return router;
}
