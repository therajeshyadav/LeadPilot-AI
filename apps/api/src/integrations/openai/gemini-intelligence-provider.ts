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

Extract these EXACT fields:
- budget: string or null (any monetary amount mentioned or budget discussion)
- productType: string or null (what product/service they're interested in)
- productCount: number or null (approximate number of products/SKUs)
- launchTimeline: string or null (when they want to buy/implement)
- requiredFeatures: array of strings (specific features/requirements mentioned)
- notes: string or null (pain points, company info, and other relevant details combined)

Only include information explicitly mentioned in the conversation. Use null for missing information.

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
      return this.sanitizeDiscovery(extracted);
    } catch (error) {
      console.error("Discovery extraction failed:", error);
      return {};
    }
  }

  /**
   * Sanitize AI-extracted discovery data to match Prisma Lead schema.
   * Maps common AI field name mismatches and strips unknown fields.
   */
  private sanitizeDiscovery(raw: Record<string, unknown>): UpdateLeadDiscoveryInput {
    // Build notes from extra fields the AI may return
    const extraParts: string[] = [];
    if (raw.painPoints && Array.isArray(raw.painPoints) && raw.painPoints.length > 0) {
      extraParts.push(`Pain points: ${raw.painPoints.join("; ")}`);
    }
    if (raw.companyInfo && typeof raw.companyInfo === "object") {
      extraParts.push(`Company info: ${JSON.stringify(raw.companyInfo)}`);
    }

    const existingNotes = typeof raw.notes === "string" ? raw.notes : null;
    const combinedNotes = [existingNotes, ...extraParts].filter(Boolean).join(" | ") || undefined;

    // Map AI field names to Prisma column names
    const timeline = raw.launchTimeline ?? raw.timeline;
    const features = raw.requiredFeatures ?? raw.requirements;

    const result: UpdateLeadDiscoveryInput = {
      budget: typeof raw.budget === "string" ? raw.budget : undefined,
      productType: typeof raw.productType === "string" ? raw.productType : undefined,
      productCount: typeof raw.productCount === "number" ? raw.productCount : undefined,
      launchTimeline: typeof timeline === "string" ? timeline : undefined,
      requiredFeatures: Array.isArray(features) ? features.filter((f): f is string => typeof f === "string") : undefined,
      notes: combinedNotes,
    };

    // Remove undefined keys so Prisma only updates provided fields
    return Object.fromEntries(
      Object.entries(result).filter(([, v]) => v !== undefined)
    ) as UpdateLeadDiscoveryInput;
  }

  async qualifyConversation(input: { 
    transcript: string; 
    currentLead: UpdateLeadDiscoveryInput 
  }): Promise<LeadQualification> {
    try {
      const prompt = `You are an expert Indian sales lead qualifier for an e-commerce website agency. Analyze this conversation and classify the lead.

This is a REAL-TIME mid-call analysis. The transcript may be PARTIAL (call still ongoing). Score based on what IS said, not what is missing.

## CLASSIFICATION RULES (apply in order):

### HOT (score 75-100) — Assign HOT if ANY of these are true:
1. Customer explicitly says they WANT the project/product/service:
   - English: "I want this", "I want to proceed", "let's start", "I'm ready", "I want to go ahead", "sign me up"
   - Hindi/Hinglish: "mujhe chahiye", "mujhe project chahiye", "haan karna hai", "start karo", "ready hu", "karna chahta hu", "karwa do", "bana do"
2. Customer discusses a CONCRETE budget AND specific requirements (product count, features, product type)
3. Customer asks about pricing/payment terms with intent to buy (not just curiosity)
4. Customer provides their business details AND asks for next steps/proposal/demo

### WARM (score 40-74) — Assign WARM if:
- Customer shows interest but adds hesitation: "sochna padega", "discuss karunga", "need to think", "let me check", "budget nahi pata", "not sure about timeline"
- Customer asks questions but has not committed
- Budget is mentioned but seems unrealistic or very vague ("depends", "flexible")
- Decision depends on someone else ("boss se puchna padega", "partner se baat karni hai")
- Timeline is months away or not urgent

### COLD (score 0-39) — Assign COLD if:
- Customer is just researching with no current need
- No budget, no requirements, no interest signals
- Customer says "not interested", "don't need", "just looking"
- Wrong contact / not the decision maker and unwilling to connect

## IMPORTANT:
- A customer saying "mujhe project chahiye" (I want this project) + discussing features/budget = HOT, NOT WARM
- Do NOT penalize for missing timeline if budget + requirements + intent are strong
- Indian customers often express intent indirectly — treat feature/product discussions with budget as strong signals
- Partial mid-call transcripts should not be scored lower just because the call isn't finished

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
    "buyingIntent": "<analysis of buying intent with exact quotes>",
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
        score: Math.max(0, Math.min(100, qualification.score || 0)),
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
      const contactNumber = process.env.SALES_CONTACT_PHONE || "+91-9876543210";

      const prompt = `Generate a personalized WhatsApp follow-up message based on this conversation.

Requirements:
- Language: ${targetLanguage}
- Tone: Professional, friendly, conversational
- Length: 2-4 sentences
- Reference specific details from the conversation:
  * Product/business type if mentioned
  * Budget range if discussed
  * Timeline if mentioned
  * Key requirements or features discussed
  * Any concerns or questions they had
- Write as a natural human follow-up (NOT a table or list format)
- MUST include contact number: ${contactNumber}
${input.name ? `- Address customer as: ${input.name}` : "- Use appropriate greeting"}

STRICT RULES — NEVER VIOLATE:
- Do NOT invent discounts, offers, or deals that were not explicitly mentioned
- Do NOT create fake deadlines or urgency (e.g., "limited time", "offer expires")
- Do NOT mention prices, costs, or budgets unless the customer stated them
- Do NOT promise features, timelines, or deliverables that were not discussed
- Do NOT add booking links, appointment offers, or scheduling unless discussed
- Do NOT fabricate testimonials, statistics, or social proof
- ONLY reference information that appears in the transcript below
- If the transcript is empty or unclear, send a simple thank you message

Conversation transcript:
${input.transcript}

Generate ONLY the WhatsApp message text (no quotes, no labels):`;

      const response = await this.generateContent(prompt);
      const message = response.trim();
      
      // Ensure message is never empty
      if (!message || message.length < 10) {
        return this.getFallbackFollowUpMessage(input.language, input.name, contactNumber);
      }
      
      return message;
    } catch (error) {
      console.error("Follow-up generation failed:", error);
      const contactNumber = process.env.SALES_CONTACT_PHONE || "+91-9876543210";
      return this.getFallbackFollowUpMessage(input.language, input.name, contactNumber);
    }
  }

  private getFallbackFollowUpMessage(language: SupportedLanguage, name?: string, contactNumber?: string): string {
    const contact = contactNumber || "+91-9876543210";
    const customerName = name || "";
    
    const fallbacks = {
      ENGLISH: `Hi${customerName ? ` ${customerName}` : ""}! Thank you for your interest in our e-commerce development services. We'll send you more details shortly.\n\n📞 Contact: ${contact}`,
      HINDI: `नमस्ते${customerName ? ` ${customerName}` : ""}! हमारी e-commerce development services में आपकी रुचि के लिए धन्यवाद। हम जल्द ही आपको और जानकारी भेजेंगे।\n\n📞 संपर्क: ${contact}`,
      TELUGU: `నమస్కారం${customerName ? ` ${customerName}` : ""}! మా e-commerce development services పట్ల మీ ఆసక్తికి ధన్యవాదాలు। మేము త్వరలో మరిన్ని వివరాలను పంపుతాము।\n\n📞 సంప్రదింపు: ${contact}`,
      UNKNOWN: `Hi${customerName ? ` ${customerName}` : ""}! Thank you for your interest in our e-commerce development services. We'll send you more details shortly.\n\n📞 Contact: ${contact}`
    };
    
    return fallbacks[language] || fallbacks.UNKNOWN;
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

      const prompt = `Generate a PERSONALIZED WhatsApp message for a lead who just showed strong buying intent.

Requirements:
- Language: ${targetLanguage}
- Tone: Warm, professional, enthusiastic (but NOT pushy)
- Length: 3-4 sentences
- Acknowledge their specific interests from the conversation
- Suggest connecting further to discuss details
${input.name ? `- Address customer as: ${input.name}` : ""}

STRICT RULES — NEVER VIOLATE:
- Do NOT invent discounts, special offers, or deals
- Do NOT create fake deadlines or urgency (e.g., "limited slots", "offer expires today")
- Do NOT mention prices, costs, or budgets unless the customer explicitly stated them
- Do NOT promise features, timelines, or deliverables that were not discussed
- Do NOT fabricate booking offers, free consultations, or trial periods unless discussed
- Do NOT add statistics, testimonials, or social proof that wasn't mentioned
- ONLY reference information that appears in the conversation below

Discovered information (from conversation only):
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
      const prompt = `Analyze if the customer EXPLICITLY requested a callback and extract timing details.

CRITICAL RULES:
- ONLY set requested=true if the customer EXPLICITLY asks to be called back
- Normal conversation, questions, or interest do NOT count as callback requests
- The customer must use phrases that request a future call

Examples that ARE callback requests:
- "Call me tomorrow" / "kal call karna" / "రేపు కాల్ చేయండి"
- "Call me at 5 PM" / "5 baje call karo" / "5 గంటలకు కాల్ చేయండి"
- "Call me back tomorrow morning" / "kal subah call karna"
- "I'll talk to you later, call me in the evening"

Examples that are NOT callback requests:
- "I need a website" / "mujhe website chahiye"
- "My budget is 20k" / "mera budget 20k hai"
- "Send me details" / "details bhejo"
- "I will think about it" / "sochke bataunga"
- "I need to discuss with my brother" / "bhai se discuss karunga"
- "Okay, thank you" / "theek hai, dhanyavaad"
- "What are the features?" / "features kya hain"

Transcript:
${transcript}

Language: ${language}

Return ONLY valid JSON (no markdown, no code blocks). Use null (NOT undefined) for missing values:
{
  "requested": true/false,
  "date": "YYYY-MM-DD" or null,
  "timeOfDay": "morning"/"afternoon"/"evening"/"specific" or null,
  "specificTime": "HH:MM" or null,
  "originalText": "exact phrase from transcript" or null
}`;

      const response = await this.generateContent(prompt);
      
      // Clean response
      let cleaned = response.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/```\n?/g, "");
      }
      
      // Replace JavaScript undefined with null before parsing
      cleaned = cleaned.replace(/:\s*undefined/g, ': null');
      
      const intent = JSON.parse(cleaned);
      
      return {
        requested: Boolean(intent.requested),
        date: intent.date || undefined,
        timeOfDay: intent.timeOfDay || undefined,
        specificTime: intent.specificTime || undefined,
        originalText: intent.originalText || ""
      };
    } catch (error) {
      console.error("Callback intent detection failed:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      return {
        requested: false,
        originalText: ""
      };
    }
  }
}
