import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  VOICE_PROVIDER: z.enum(["vapi"]).default("vapi"),
  VOICE_API_KEY: z.string().min(1).optional(),
  VOICE_AGENT_ID: z.string().min(1).optional(),
  VOICE_WEBHOOK_SECRET: z.string().min(1).optional(),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_PHONE_NUMBER: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  TWILIO_WHATSAPP_FROM: z.string().regex(/^whatsapp:\+[1-9]\d{7,14}$/).optional(),
  TWILIO_WEBHOOK_AUTH_TOKEN: z.string().min(1).optional(),
  TARGET_PHONE_NUMBER: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  SALES_CONTACT_PHONE: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().min(1).optional(),
  GOOGLE_CALENDAR_ID: z.string().min(1).default("primary"),
  DEFAULT_TIMEZONE: z.string().default("Asia/Kolkata"),
  DEFAULT_CALLBACK_MORNING_HOUR: z.coerce.number().int().min(0).max(23).default(10),
  DEFAULT_CALLBACK_AFTERNOON_HOUR: z.coerce.number().int().min(0).max(23).default(15),
  DEFAULT_CALLBACK_EVENING_HOUR: z.coerce.number().int().min(0).max(23).default(18),
  ARCHITECTURE_IMAGE_URL: z.string().url().optional(),
  RESUME_DOCUMENT_URL: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof environmentSchema> & {
  corsOrigins: string[];
};

export function loadConfig(input: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
  }

  return {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  };
}
