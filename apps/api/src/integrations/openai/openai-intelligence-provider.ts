import type { LeadQualification, SupportedLanguage, UpdateLeadDiscoveryInput } from "@leadpilot/shared";
import type { LeadIntelligenceProvider } from "./lead-intelligence-provider.js";

export class OpenAIIntelligenceProvider implements LeadIntelligenceProvider {
  private readonly apiKey: string;
  private readonly baseURL = "https://api.openai.com/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async detectLanguage(text: string): Promise<SupportedLanguage> {
    try {
      const response = await this.callOpenAI({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Detect the language of the given text. Respond with only one of these values: ENGLISH, HINDI, TELUGU, UNKNOWN

Examples:
- "Hello, how are you?" -> ENGLISH
- "नमस्ते, आप कैसे हैं?" -> HINDI  
- "హలో, మీరు ఎలా ఉన్నారు?" -> TELUGU
- Mixed or unclear -> UNKNOWN`
          },
          {
            role: "user", 
            content: text.slice(0, 500) // Limit text for efficiency
          }
        ],
        max_tokens: 10,
        temperature: 0
      });

      const detected = response.choices[0]?.message?.content?.trim().toUpperCase();
      
      if (detected && ["ENGLISH", "HINDI", "TELUGU"].includes(detected)) {
        return detected as SupportedLanguage;
      }
      
      return "UNKNOWN";
    } catch (error) {
      console.error("Language detection failed:", error);
      return "UNKNOWN";
    }
  }

  async extractDiscovery(transcript: string): Promise<UpdateLeadDiscoveryInput> {
    try {
      const response = await this.callOpenAI({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Extract lead information from this sales conversation transcript. Return a JSON object with these fields:

{
  "budget": "string or null (budget range mentioned)",
  "productType": "string or null (what they want to sell)",
  "productCount": "number or null (approximate number of products/SKUs)",
  "launchTimeline": "string or null (when they want to launch)",
  "requiredFeatures": "array of strings (features mentioned)",
  "notes": "string or null (other relevant information)"
}

Only include information explicitly mentioned. Use null for missing information.

Examples of features: "payment gateway", "inventory management", "order management", "customer login", "admin dashboard", "shipping integration", "analytics", "mobile app", "multi-language", "SEO optimization"`
          },
          {
            role: "user",
            content: transcript
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const parsed = JSON.parse(content);
      
      return {
        budget: parsed.budget || undefined,
        productType: parsed.productType || undefined,
        productCount: parsed.productCount || undefined,
        launchTimeline: parsed.launchTimeline || undefined,
        requiredFeatures: Array.isArray(parsed.requiredFeatures) ? parsed.requiredFeatures : [],
        notes: parsed.notes || undefined
      };
    } catch (error) {
      console.error("Discovery extraction failed:", error);
      return {
        requiredFeatures: []
      };
    }
  }

  async qualifyConversation(input: { transcript: string; currentLead: UpdateLeadDiscoveryInput }): Promise<LeadQualification> {
    try {
      const response = await this.callOpenAI({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze this sales conversation and qualify the lead. Return a JSON object:

{
  "classification": "HOT" | "WARM" | "COLD",
  "score": number (0-100),
  "reasoning": "string (explanation for classification)",
  "signals": {
    "buyingIntent": "string (evidence of intent to buy)",
    "budget": "string (budget-related signals)",
    "timeline": "string (timeline-related signals)", 
    "requirements": "string (requirement clarity signals)"
  }
}

Classification Guidelines:
- HOT: Strong buying intent, clear requirements, reasonable budget/timeline, wants next steps
- WARM: Some interest, requirements exist, but budget/timeline/intent unclear  
- COLD: No meaningful interest, no current requirement, not planning to buy

Focus on actual conversation content, not just keywords.`
          },
          {
            role: "user",
            content: `Conversation transcript: ${input.transcript}

Current lead info: ${JSON.stringify(input.currentLead, null, 2)}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const parsed = JSON.parse(content);
      
      return {
        classification: parsed.classification || "COLD",
        score: Math.max(0, Math.min(100, parsed.score || 0)),
        reasoning: parsed.reasoning || "Could not analyze conversation",
        signals: {
          buyingIntent: parsed.signals?.buyingIntent || "",
          budget: parsed.signals?.budget || "",
          timeline: parsed.signals?.timeline || "",
          requirements: parsed.signals?.requirements || ""
        }
      };
    } catch (error) {
      console.error("Lead qualification failed:", error);
      return {
        classification: "COLD",
        score: 0,
        reasoning: "Analysis failed due to technical error",
        signals: {
          buyingIntent: "",
          budget: "",
          timeline: "",
          requirements: ""
        }
      };
    }
  }

  async generateFollowUp(input: { name?: string; language: SupportedLanguage; transcript: string }): Promise<string> {
    try {
      const languagePrompts = {
        ENGLISH: "Generate a personalized WhatsApp follow-up message in English",
        HINDI: "Generate a personalized WhatsApp follow-up message in Hindi (Devanagari script)",
        TELUGU: "Generate a personalized WhatsApp follow-up message in Telugu script", 
        UNKNOWN: "Generate a personalized WhatsApp follow-up message in English"
      };

      const response = await this.callOpenAI({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `${languagePrompts[input.language]}. 

Based on the conversation, create a contextual follow-up that:
1. References specific details discussed (budget, requirements, timeline)
2. Includes next steps or relevant information
3. Maintains professional but friendly tone
4. Keep it concise (2-3 sentences max)
5. Include contact number: +91-9876543210

Do NOT make up information not mentioned in the conversation.`
          },
          {
            role: "user",
            content: `Customer name: ${input.name || "Customer"}
Conversation: ${input.transcript}`
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content?.trim() || 
        `Hi ${input.name || ""}, thank you for your interest in our e-commerce development services. We'll be in touch soon to discuss your requirements. Contact: +91-9876543210`;
    } catch (error) {
      console.error("Follow-up generation failed:", error);
      return `Hi ${input.name || ""}, thank you for your interest in our e-commerce development services. We'll be in touch soon to discuss your requirements. Contact: +91-9876543210`;
    }
  }

  private async callOpenAI(body: any): Promise<any> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API failed: ${response.status} ${error}`);
    }

    return response.json();
  }
}