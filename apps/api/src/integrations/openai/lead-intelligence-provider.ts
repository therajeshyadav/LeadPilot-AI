import type { LeadQualification, SupportedLanguage, UpdateLeadDiscoveryInput } from "@leadpilot/shared";

export interface CallbackIntent {
  requested: boolean;
  date?: string; // ISO date string
  timeOfDay?: "morning" | "afternoon" | "evening" | "specific";
  specificTime?: string; // HH:MM format
  originalText: string;
}

export interface LeadIntelligenceProvider {
  detectLanguage(text: string): Promise<SupportedLanguage>;
  extractDiscovery(text: string): Promise<UpdateLeadDiscoveryInput>;
  qualifyConversation(input: { transcript: string; currentLead: UpdateLeadDiscoveryInput }): Promise<LeadQualification>;
  generateFollowUp(input: { name?: string; language: SupportedLanguage; transcript: string }): Promise<string>;
  generateHotLeadMessage(input: { name?: string; language: SupportedLanguage; transcript: string; discoveredInfo?: { budget?: string; productType?: string; timeline?: string; requirements?: string[] } }): Promise<string>;
  detectCallbackIntent(transcript: string, language: SupportedLanguage): Promise<CallbackIntent>;
}
