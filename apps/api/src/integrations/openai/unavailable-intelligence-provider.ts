import type { LeadQualification, SupportedLanguage, UpdateLeadDiscoveryInput } from "@leadpilot/shared";
import type { CallbackIntent, LeadIntelligenceProvider } from "./lead-intelligence-provider.js";

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

  async generateHotLeadMessage(input: { name?: string; language: SupportedLanguage; transcript: string; discoveredInfo?: { budget?: string; productType?: string; timeline?: string; requirements?: string[] } }): Promise<string> {
    const name = input.name || "Customer";
    return `Hi ${name}, thank you for your interest in our e-commerce development services. We'll send you a proposal shortly.`;
  }

  async generateFollowUp(input: { name?: string; language: SupportedLanguage; transcript: string }): Promise<string> {
    return `Hi ${input.name || ""}, thank you for your interest in our services. We'll be in touch soon.`;
  }

  async detectCallbackIntent(transcript: string, language: SupportedLanguage): Promise<CallbackIntent> {
    return { requested: false, originalText: "" };
  }
}