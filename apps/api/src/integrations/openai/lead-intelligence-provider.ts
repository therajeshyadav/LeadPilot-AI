import type { LeadQualification, SupportedLanguage, UpdateLeadDiscoveryInput } from "@leadpilot/shared";

export interface LeadIntelligenceProvider {
  detectLanguage(text: string): Promise<SupportedLanguage>;
  extractDiscovery(text: string): Promise<UpdateLeadDiscoveryInput>;
  qualifyConversation(input: { transcript: string; currentLead: UpdateLeadDiscoveryInput }): Promise<LeadQualification>;
  generateFollowUp(input: { name?: string; language: SupportedLanguage; transcript: string }): Promise<string>;
}
