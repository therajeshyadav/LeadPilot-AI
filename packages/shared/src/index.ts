import { z } from "zod";

export const supportedLanguageSchema = z.enum(["ENGLISH", "HINDI", "TELUGU", "UNKNOWN"]);
export const leadStatusSchema = z.enum(["UNQUALIFIED", "HOT", "WARM", "COLD"]);
export const conversationOutcomeSchema = z.enum([
  "IN_PROGRESS",
  "COMPLETED",
  "NO_ANSWER",
  "VOICEMAIL",
  "FAILED",
  "ENDED_EARLY",
]);
export const conversationRoleSchema = z.enum(["AGENT", "CUSTOMER", "SYSTEM", "TOOL"]);
export const callbackStatusSchema = z.enum(["SCHEDULED", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"]);
export const whatsappMessageTypeSchema = z.enum(["HOT_LEAD", "FOLLOW_UP", "MANUAL"]);
export const whatsappMessageStatusSchema = z.enum(["PENDING", "SENT", "DELIVERED", "FAILED"]);
export const qualificationClassificationSchema = z.enum(["HOT", "WARM", "COLD"]);

export const e164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format, for example +919876543210.");

export const requiredFeaturesSchema = z.array(z.string().trim().min(1).max(120)).max(30).transform((features) => {
  return [...new Set(features.map((feature) => feature.toLowerCase()))];
});

export const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: e164PhoneSchema,
  language: supportedLanguageSchema.optional(),
  budget: z.string().trim().min(1).max(120).optional(),
  productType: z.string().trim().min(1).max(160).optional(),
  productCount: z.coerce.number().int().nonnegative().max(10_000_000).optional(),
  launchTimeline: z.string().trim().min(1).max(160).optional(),
  requiredFeatures: requiredFeaturesSchema.optional(),
  notes: z.string().trim().min(1).max(5_000).optional(),
});

export const updateLeadDiscoverySchema = createLeadSchema
  .omit({ phone: true })
  .extend({ language: supportedLanguageSchema.optional() })
  .refine((value) => Object.values(value).some((item) => item !== undefined), "At least one field must be supplied.");

export const qualificationSignalsSchema = z.object({
  buyingIntent: z.string().trim().min(1).max(2_000),
  budget: z.string().trim().min(1).max(2_000),
  timeline: z.string().trim().min(1).max(2_000),
  requirements: z.string().trim().min(1).max(2_000),
});

export const leadQualificationSchema = z.object({
  classification: qualificationClassificationSchema,
  score: z.number().int().min(0).max(100),
  reasoning: z.string().trim().min(1).max(4_000),
  signals: qualificationSignalsSchema,
});

export const recordQualificationSchema = leadQualificationSchema.extend({
  conversationId: z.string().cuid().optional(),
});

export const createConversationSchema = z.object({
  leadId: z.string().cuid(),
  providerCallId: z.string().trim().min(1).max(255),
  startedAt: z.coerce.date().optional(),
  detectedLanguage: supportedLanguageSchema.optional(),
});

export const conversationMessageSchema = z.object({
  role: conversationRoleSchema,
  content: z.string().trim().min(1).max(10_000),
  timestamp: z.coerce.date().optional(),
});

export const finishConversationSchema = z.object({
  endedAt: z.coerce.date().optional(),
  summary: z.string().trim().min(1).max(10_000).optional(),
  transcript: z.string().trim().min(1).max(100_000).optional(),
  outcome: conversationOutcomeSchema,
  detectedLanguage: supportedLanguageSchema.optional(),
});

export const createCallbackSchema = z.object({
  scheduledFor: z.coerce.date(),
  timezone: z.string().trim().min(1).max(100).default("Asia/Kolkata"),
  sourceText: z.string().trim().min(1).max(2_000),
});

export const sendWhatsAppSchema = z.object({
  conversationId: z.string().cuid().optional(),
  type: whatsappMessageTypeSchema.default("MANUAL"),
  message: z.string().trim().min(1).max(4_096),
  mediaUrl: z.string().url().optional(),
  idempotencyKey: z.string().trim().min(1).max(255).optional(),
});

export const leadIdParamSchema = z.object({ id: z.string().cuid() });
export const conversationIdParamSchema = z.object({ id: z.string().cuid() });

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("leadpilot-api"),
  timestamp: z.string().datetime(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;
export type LeadStatus = z.infer<typeof leadStatusSchema>;
export type ConversationOutcome = z.infer<typeof conversationOutcomeSchema>;
export type ConversationRole = z.infer<typeof conversationRoleSchema>;
export type CallbackStatus = z.infer<typeof callbackStatusSchema>;
export type WhatsAppMessageType = z.infer<typeof whatsappMessageTypeSchema>;
export type WhatsAppMessageStatus = z.infer<typeof whatsappMessageStatusSchema>;
export type QualificationClassification = z.infer<typeof qualificationClassificationSchema>;
export type LeadQualification = z.infer<typeof leadQualificationSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadDiscoveryInput = z.infer<typeof updateLeadDiscoverySchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ConversationMessageInput = z.infer<typeof conversationMessageSchema>;
export type FinishConversationInput = z.infer<typeof finishConversationSchema>;
export type CreateCallbackInput = z.infer<typeof createCallbackSchema>;
export type SendWhatsAppInput = z.infer<typeof sendWhatsAppSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
