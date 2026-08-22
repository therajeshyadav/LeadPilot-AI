import type { LeadQualification, SupportedLanguage, UpdateLeadDiscoveryInput } from "@leadpilot/shared";
import type { LeadIntelligenceProvider } from "./lead-intelligence-provider.js";

export class UnavailableIntelligenceProvider implements LeadIntelligenceProvider {
  async detectLanguage(text: string): Promise<SupportedLanguage> {
    return "UNKNOWN";
  }

  async extractDiscovery(transcript: string): Promise<UpdateLeadDiscoveryInput> {
    return {
      requiredFeatures: []
    };
  }

  async qualifyConversation(input: { transcript: string; currentLead: UpdateLeadDiscoveryInput }): Promise<LeadQualification> {
    return {
      classification: "COLD",
      score: 0,
      reasoning: "OpenAI integration not configured",
      signals: {
        buyingIntent: "Service unavailable",
        budget: "Service unavailable", 
        timeline: "Service unavailable",
        requirements: "Service unavailable"
      }
    };
  }

  async generateFollowUp(input: { name?: string; language: SupportedLanguage; transcript: string }): Promise<string> {
    return `Hi ${input.name || ""}, thank you for your interest in our services. We'll be in touch soon.`;
  }
}