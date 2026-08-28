import { GoogleGenAI } from "@google/genai";
import type { LeadQualification, SupportedLanguage, UpdateLeadDiscoveryInput } from "@leadpilot/shared";
import type { CallbackIntent, LeadIntelligenceProvider } from "./lead-intelligence-provider.js";

export class GeminiIntelligenceProvider implements LeadIntelligenceProvider {
  private readonly genAI: GoogleGenAI;
  private readonly modelName: string;

  constructor(apiKey: string, modelName: string = "gemini-2.0-flash-exp") {
    this.genAI = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  private async generateContent(prompt: string): Promise<string> {
    try {
      const response = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: prompt,
      });
      
      return response.text ?? "";
    } catch (error: any) {
      console.error("Gemini API failed:", error);
      console.error("Error details:", error?.message, error?.status, error?.statusText);
      throw new Error(`Gemini API failed: ${error?.message || error}`);
    }
  }

  async detectLanguage(text: string): Promise<SupportedLanguage> {
    try {
      const prompt = `Detect the language of the given text. Respond with only one of these values: ENGLISH, HINDI, TELUGU, UNKNOWN

Examples:
- "Hello, how are you?" -> ENGLISH
- "नमस्ते, आप कैसे हैं?" -> HINDI  
- "హలో, మీరు ఎలా ఉన్నారు?" -> TELUGU
- Mixed or unclear -> UNKNOWN

Text to analyze:
${text.slice(0, 500)}

Language:`;

      const response = await this.generateContent(prompt);
      const detected = response.trim().toUpperCase();
      
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
      const prompt = `Extract key information from this sales conversation transcript and return ONLY a valid JSON object. DO NOT include any markdown formatting, code blocks, or explanations.

Extract:
- budget: any monetary amount mentioned or budget discussion
- productType: what product/service they're interested in
- timeline: when they want to buy/implement
- requirements: array of specific requirements mentioned
- painPoints: array of problems/challenges they mentioned
- companyInfo: any company details like name, size, industry

Transcript:
${transcript}

Return ONLY the JSON object:`;

      const response = await this.generateContent(prompt);
      
      // Clean response - remove markdown code blocks if present
      let cleaned = response.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```\n?/g, "");
      }
      
      const extracted = JSON.parse(cleaned);
      return extracted;
    } catch (error) {
      console.error("Discovery extraction failed:", error);
      return {};
    }
  }

  async qualifyConversation(input: { 
    transcript: string; 
    currentLead: UpdateLeadDiscoveryInput 
  }): Promise<LeadQualification> {
    try {
      const prompt = `Analyze this sales conversation and qualify the lead as HOT, WARM, or COLD.

HOT (75-100 score): 
- Ready to buy soon (within days/weeks)
- Clear budget discussed
- Decision maker engaged
- Specific requirements mentioned
- Strong buying signals

WARM (40-74 score):
- Interested but not urgent
- Budget discussed but vague
- Needs more information
- Timeline is months away
- Some requirements mentioned

COLD (0-39 score):
- Just researching
- No budget mentioned
- No clear timeline
- Vague interest
- Not decision maker

Current lead info:
${JSON.stringify(input.currentLead, null, 2)}

Conversation transcript:
${input.transcript}

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "classification": "HOT" | "WARM" | "COLD",
  "score": <number 0-100>,
  "reasoning": "<brief explanation>",
  "signals": {
    "buyingIntent": "<analysis of buying intent>",
    "budget": "<budget discussion summary>",
    "timeline": "<timeline mentioned>",
    "requirements": "<specific requirements mentioned>"
  }
}`;

      const response = await this.generateContent(prompt);
      
      // Clean response
      let cleaned = response.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```\n?/g, "");
      }
      
      const qualification = JSON.parse(cleaned);
      
      return {
        classification: qualification.classification || "COLD",
        score: qualification.score || 0,
        reasoning: qualification.reasoning || "Unable to determine qualification",
        signals: qualification.signals || {
          buyingIntent: "Unknown",
          budget: "Not discussed",
          timeline: "Not mentioned",
          requirements: "Not specified"
        }
      };
    } catch (error) {
      console.error("Lead qualification failed:", error);
      return {
        classification: "COLD",
        score: 0,
        reasoning: `Qualification error: ${error}`,
        signals: {
          buyingIntent: "Error during analysis",
          budget: "Not analyzed",
          timeline: "Not analyzed",
          requirements: "Not analyzed"
        }
      };
    }
  }

  async generateFollowUp(input: { 
    name?: string; 
    language: SupportedLanguage; 
    transcript: string 
  }): Promise<string> {
    try {
      const languageMap = {
        ENGLISH: "English",
        HINDI: "Hindi (Devanagari script)",
        TELUGU: "Telugu",
        UNKNOWN: "English"
      };

      const targetLanguage = languageMap[input.language] || "English";

      const prompt = `Generate a personalized WhatsApp follow-up message based on this conversation.

Requirements:
- Language: ${targetLanguage}
- Tone: Professional, friendly, conversational
- Length: 2-3 sentences max
- Reference specific points from conversation
- Include next steps
${input.name ? `- Address customer as: ${input.name}` : "- Don't use generic greetings"}

Conversation transcript:
${input.transcript}

Generate ONLY the WhatsApp message text (no quotes, no labels):`;

      const response = await this.generateContent(prompt);
      return response.trim();
    } catch (error) {
      console.error("Follow-up generation failed:", error);
      
      // Fallback messages
      const fallbacks = {
        ENGLISH: `Thank you for your interest! I'll send you more details shortly.`,
        HINDI: `आपकी रुचि के लिए धन्यवाद! मैं जल्द ही आपको और जानकारी भेजूंगा।`,
        TELUGU: `మీ ఆసక్తికి ధన్యవాదాలు! నేను త్వరలో మరిన్ని వివరాలను పంపుతాను।`,
        UNKNOWN: `Thank you for your interest! I'll send you more details shortly.`
      };
      
      return fallbacks[input.language] || fallbacks.UNKNOWN;
    }
  }

  async generateHotLeadMessage(input: { 
    name?: string; 
    language: SupportedLanguage; 
    transcript: string;
    discoveredInfo?: { 
      budget?: string; 
      productType?: string; 
      timeline?: string; 
      requirements?: string[] 
    }
  }): Promise<string> {
    try {
      const languageMap = {
        ENGLISH: "English",
        HINDI: "Hindi (Devanagari script)",
        TELUGU: "Telugu",
        UNKNOWN: "English"
      };

      const targetLanguage = languageMap[input.language] || "English";

      const prompt = `Generate an URGENT, PERSONALIZED WhatsApp message for a HOT LEAD who just showed strong buying intent.

Requirements:
- Language: ${targetLanguage}
- Tone: Excited but professional, action-oriented
- Length: 3-4 sentences
- Acknowledge their specific interests
- Create urgency
- Clear call-to-action
${input.name ? `- Address customer as: ${input.name}` : ""}

Discovered information:
${JSON.stringify(input.discoveredInfo || {}, null, 2)}

Conversation highlights:
${input.transcript.slice(-500)} (last 500 chars)

Generate ONLY the WhatsApp message (no quotes, no labels):`;

      const response = await this.generateContent(prompt);
      return response.trim();
    } catch (error) {
      console.error("Hot lead message generation failed:", error);
      
      // Fallback messages
      const fallbacks = {
        ENGLISH: `Great speaking with you! Based on our conversation, I have the perfect solution for you. Let's connect soon to finalize the details!`,
        HINDI: `आपसे बात करके बहुत अच्छा लगा! हमारी बातचीत के आधार पर, मेरे पास आपके लिए एकदम सही समाधान है। जल्द ही विवरण अंतिम रूप देने के लिए जुड़ते हैं!`,
        TELUGU: `మీతో మాట్లాడటం చాలా బాగుంది! మా సంభాషణ ఆధారంగా, మీ కోసం సరైన పరిష్కారం నా వద్ద ఉంది. వివరాలను ఖరారు చేయడానికి త్వరలో కనెక్ట్ అవుదాం!`,
        UNKNOWN: `Great speaking with you! Based on our conversation, I have the perfect solution for you. Let's connect soon!`
      };
      
      return fallbacks[input.language] || fallbacks.UNKNOWN;
    }
  }

  async detectCallbackIntent(transcript: string, language: SupportedLanguage): Promise<CallbackIntent> {
    try {
      const prompt = `Analyze if the customer requested a callback and extract timing details.

Transcript:
${transcript}

Language: ${language}

Detect callback requests in any language (English, Hindi, Telugu).
Common phrases:
- "call me back", "baad mein call karo", "తిరిగి కాల్ చేయండి"
- "morning", "subah", "ఉదయం"
- "afternoon", "dopahar", "మధ్యాహ్నం"  
- "evening", "shaam", "సాయంత్రం"
- "tomorrow", "kal", "రేపు"
- Specific times like "3 PM", "teen baje", etc.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "requested": true/false,
  "date": "YYYY-MM-DD" or undefined,
  "timeOfDay": "morning"/"afternoon"/"evening"/"specific" or undefined,
  "specificTime": "HH:MM" or undefined,
  "originalText": "exact phrase from transcript"
}`;

      const response = await this.generateContent(prompt);
      
      // Clean response
      let cleaned = response.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```\n?/g, "");
      }
      
      const intent = JSON.parse(cleaned);
      
      return {
        requested: intent.requested || false,
        date: intent.date,
        timeOfDay: intent.timeOfDay,
        specificTime: intent.specificTime,
        originalText: intent.originalText || ""
      };
    } catch (error) {
      console.error("Callback intent detection failed:", error);
      return {
        requested: false,
        originalText: ""
      };
    }
  }
}
