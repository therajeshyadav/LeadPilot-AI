import type { CalendarProvider } from "../integrations/calendar/calendar-provider.js";
import type { LeadIntelligenceProvider } from "../integrations/openai/lead-intelligence-provider.js";
import type { VoiceProvider } from "../integrations/voice/voice-provider.js";
import type { WhatsAppProvider } from "../integrations/whatsapp/whatsapp-provider.js";
import type { Repositories } from "../repositories/contracts.js";
import { CallbackService } from "./callback.service.js";
import { ConversationService } from "./conversation.service.js";
import { LeadService } from "./lead.service.js";
import { QualificationService } from "./qualification.service.js";
import { VoiceService } from "./voice.service.js";
import { WhatsAppService } from "./whatsapp.service.js";

export interface AppServices {
  leads: LeadService;
  conversations: ConversationService;
  qualifications: QualificationService;
  callbacks: CallbackService;
  whatsapp: WhatsAppService;
  voice: VoiceService;
}

export function createServices(input: {
  repositories: Repositories;
  whatsappProvider: WhatsAppProvider;
  voiceProvider?: VoiceProvider;
  intelligenceProvider?: LeadIntelligenceProvider;
  calendarProvider?: CalendarProvider;
  defaultAssistantId?: string;
}): AppServices {
  const { repositories } = input;
  
  // Create services without circular dependencies first
  const leads = new LeadService(repositories.leads);
  const conversations = new ConversationService(repositories.conversations, repositories.leads);
  const qualifications = new QualificationService(
    repositories.leads, 
    repositories.conversations, 
    repositories.qualifications,
    input.intelligenceProvider
  );
  const callbacks = new CallbackService(
    repositories.callbacks, 
    repositories.leads, 
    input.calendarProvider,
    input.voiceProvider,
    input.defaultAssistantId
  );
  const whatsapp = new WhatsAppService(repositories.whatsappMessages, repositories.leads, input.whatsappProvider, input.intelligenceProvider);
  
  // Create voice service with whatsapp and callbacks dependencies
  const voice = new VoiceService(
    repositories.conversations, 
    repositories.leads, 
    input.voiceProvider, 
    input.intelligenceProvider,
    whatsapp,
    callbacks
  );

  return {
    leads,
    conversations,
    qualifications,
    callbacks,
    whatsapp,
    voice,
  };
}
