import type { CalendarProvider } from "../integrations/calendar/calendar-provider.js";
import type { WhatsAppProvider } from "../integrations/whatsapp/whatsapp-provider.js";
import type { Repositories } from "../repositories/contracts.js";
import { CallbackService } from "./callback.service.js";
import { ConversationService } from "./conversation.service.js";
import { LeadService } from "./lead.service.js";
import { QualificationService } from "./qualification.service.js";
import { WhatsAppService } from "./whatsapp.service.js";

export interface AppServices {
  leads: LeadService;
  conversations: ConversationService;
  qualifications: QualificationService;
  callbacks: CallbackService;
  whatsapp: WhatsAppService;
}

export function createServices(input: {
  repositories: Repositories;
  whatsappProvider: WhatsAppProvider;
  calendarProvider?: CalendarProvider;
}): AppServices {
  const { repositories } = input;
  return {
    leads: new LeadService(repositories.leads),
    conversations: new ConversationService(repositories.conversations, repositories.leads),
    qualifications: new QualificationService(repositories.leads, repositories.conversations, repositories.qualifications),
    callbacks: new CallbackService(repositories.callbacks, repositories.leads, input.calendarProvider),
    whatsapp: new WhatsAppService(repositories.whatsappMessages, repositories.leads, input.whatsappProvider),
  };
}
