import type { AppConfig } from "./env.js";
import type { AppServices } from "../services/service-factory.js";
import { createServices } from "../services/service-factory.js";
import { createPrismaRepositories } from "../repositories/prisma-repositories.js";
import { createUnavailableRepositories } from "../repositories/unavailable-repositories.js";
import { OpenAIIntelligenceProvider } from "../integrations/openai/openai-intelligence-provider.js";
import { GeminiIntelligenceProvider } from "../integrations/openai/gemini-intelligence-provider.js";
import { GroqIntelligenceProvider } from "../integrations/openai/groq-intelligence-provider.js";
import { UnavailableIntelligenceProvider } from "../integrations/openai/unavailable-intelligence-provider.js";
import { VapiProvider } from "../integrations/voice/vapi-provider.js";
import { UnavailableVoiceProvider } from "../integrations/voice/unavailable-voice-provider.js";
import { TwilioWhatsAppProvider } from "../integrations/whatsapp/twilio-whatsapp-provider.js";
import { UnavailableWhatsAppProvider } from "../integrations/whatsapp/unavailable-whatsapp-provider.js";
import { GoogleCalendarProvider } from "../integrations/calendar/google-calendar-provider.js";

export function createConfiguredServices(config: AppConfig): AppServices {
  // Setup repositories
  const repositorySetup = config.DATABASE_URL 
    ? createPrismaRepositories(config.DATABASE_URL)
    : { repositories: createUnavailableRepositories() };

  const repositories = repositorySetup.repositories;

  // Setup AI intelligence provider
  let intelligenceProvider;
  if (config.GROQ_API_KEY) {
    // Use Groq (FREE & FAST!)
    intelligenceProvider = new GroqIntelligenceProvider(config.GROQ_API_KEY, config.GROQ_MODEL || "openai/gpt-oss-120b");
    console.log("✅ Using Groq AI:", config.GROQ_MODEL || "openai/gpt-oss-120b");
  } else if (config.GEMINI_API_KEY) {
    // Fallback to Gemini
    intelligenceProvider = new GeminiIntelligenceProvider(config.GEMINI_API_KEY, config.GEMINI_MODEL || "gemini-1.5-flash-latest");
    console.log("✅ Using Gemini AI:", config.GEMINI_MODEL || "gemini-1.5-flash-latest");
  } else if (config.OPENAI_API_KEY) {
    // Fallback to OpenAI
    intelligenceProvider = new OpenAIIntelligenceProvider(config.OPENAI_API_KEY);
    console.log("✅ Using OpenAI");
  } else {
    intelligenceProvider = new UnavailableIntelligenceProvider();
    console.log("⚠️  No AI provider configured");
  }

  // Setup voice provider
  const voiceProvider = (config.VOICE_PROVIDER === "vapi" && config.VOICE_API_KEY)
    ? new VapiProvider(
        config.VOICE_API_KEY,
        config.VOICE_PHONE_NUMBER_ID && config.VOICE_PHONE_NUMBER_ID.length > 0 
          ? config.VOICE_PHONE_NUMBER_ID 
          : undefined
      )
    : new UnavailableVoiceProvider();

  // Setup WhatsApp provider
  const whatsappProvider = (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN && config.TWILIO_WHATSAPP_FROM)
    ? new TwilioWhatsAppProvider({
        accountSid: config.TWILIO_ACCOUNT_SID,
        authToken: config.TWILIO_AUTH_TOKEN,
        fromNumber: config.TWILIO_WHATSAPP_FROM,
      })
    : new UnavailableWhatsAppProvider();

  // Setup Google Calendar provider
  const calendarProvider = (
    config.GOOGLE_CLIENT_ID &&
    config.GOOGLE_CLIENT_SECRET &&
    config.GOOGLE_REDIRECT_URI &&
    config.GOOGLE_REFRESH_TOKEN &&
    config.GOOGLE_CALENDAR_ID
  )
    ? new GoogleCalendarProvider({
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        redirectUri: config.GOOGLE_REDIRECT_URI,
        refreshToken: config.GOOGLE_REFRESH_TOKEN,
        calendarId: config.GOOGLE_CALENDAR_ID,
      })
    : undefined;

  return createServices({
    repositories,
    whatsappProvider,
    voiceProvider,
    intelligenceProvider,
    calendarProvider,
    defaultAssistantId: config.VOICE_AGENT_ID,
  });
}