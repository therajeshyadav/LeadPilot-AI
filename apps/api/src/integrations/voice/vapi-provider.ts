import type { SupportedLanguage } from "@leadpilot/shared";
import type { VoiceProvider, OutboundCallRequest, VoiceCall, VoiceWebhookEvent } from "./voice-provider.js";

interface VapiCall {
  id: string;
  status: string;
  phoneNumber: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  summary?: string;
}

interface VapiWebhookPayload {
  message: {
    type: string;
    call: VapiCall;
    timestamp: string;
    transcript?: string;
    phoneNumber?: string;
  };
}

export class VapiProvider implements VoiceProvider {
  readonly name = "vapi";
  private readonly apiKey: string;
  private readonly baseURL = "https://api.vapi.ai";
  private readonly phoneNumberId?: string;

  constructor(apiKey: string, phoneNumberId?: string) {
    this.apiKey = apiKey;
    this.phoneNumberId = phoneNumberId;
  }

  async createOutboundCall(request: OutboundCallRequest): Promise<VoiceCall> {
    try {
      const payload: any = {
        assistantId: request.assistantId,
        customer: {
          number: request.to,
        }
      };

      // Use phoneNumberId if provided, otherwise Vapi uses default from dashboard
      if (this.phoneNumberId) {
        payload.phoneNumberId = this.phoneNumberId;
      }

      console.log('🔵 Vapi Outbound Call Request:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseURL}/call`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      console.log('🔵 Vapi Response:', { status: response.status, body: responseText });

      if (!response.ok) {
        console.error('🔴 Vapi Error:', responseText);
        throw new Error(`Vapi call creation failed: ${response.status} ${responseText}`);
      }

      const call: VapiCall = JSON.parse(responseText);
      
      return {
        providerCallId: call.id,
        status: call.status,
        to: request.to,
        startedAt: call.startedAt ? new Date(call.startedAt) : undefined
      };
    } catch (error) {
      throw new Error(`Failed to create Vapi outbound call: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async endCall(providerCallId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/call/${providerCallId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Vapi call end failed: ${response.status} ${error}`);
      }
    } catch (error) {
      throw new Error(`Failed to end Vapi call: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getCall(providerCallId: string): Promise<VoiceCall | null> {
    try {
      const response = await fetch(`${this.baseURL}/call/${providerCallId}`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Vapi call lookup failed: ${response.status} ${error}`);
      }

      const call: VapiCall = await response.json();
      
      return {
        providerCallId: call.id,
        status: call.status,
        to: call.phoneNumber,
        startedAt: call.startedAt ? new Date(call.startedAt) : undefined
      };
    } catch (error) {
      throw new Error(`Failed to get Vapi call: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async parseAndVerifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<VoiceWebhookEvent> {
    try {
      // Note: Vapi webhook signature verification would go here in production
      // For now, we'll parse without verification
      
      const body = JSON.parse(rawBody.toString("utf-8")) as VapiWebhookPayload;
      const { message } = body;
      
      if (!message || !message.call) {
        throw new Error("Invalid Vapi webhook payload");
      }

      // Extract transcript from message or artifact (end-of-call-report)
      let transcript = message.transcript || ((message as any).artifact && (message as any).artifact.transcript);
      
      // For conversation-update events, build full transcript from messages
      if (message.type === 'conversation-update' && body.message && (body.message as any).messages) {
        const messages = (body.message as any).messages as Array<{role: string, message: string}>;
        transcript = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.message}`)
          .join('\n');
      }

      const detectedLanguage = this.detectLanguageFromTranscript(transcript);

      return {
        eventId: `vapi_${message.call.id}_${Date.now()}`,
        type: message.type,
        providerCallId: message.call.id,
        occurredAt: new Date(message.timestamp || Date.now()),
        transcript: transcript,
        detectedLanguage,
        payload: body
      };
    } catch (error) {
      throw new Error(`Failed to parse Vapi webhook: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private detectLanguageFromTranscript(transcript?: string): SupportedLanguage | undefined {
    if (!transcript) return undefined;
    
    // Simple language detection based on script/characters
    // In production, this should use the OpenAI integration
    const text = transcript.toLowerCase();
    
    // Check for Devanagari script (Hindi)
    if (/[\u0900-\u097F]/.test(transcript)) {
      return "HINDI";
    }
    
    // Check for Telugu script
    if (/[\u0C00-\u0C7F]/.test(transcript)) {
      return "TELUGU";
    }
    
    // Check for common Hindi words in Roman script
    if (/\b(namaste|aap|kaise|hain|hai|mera|naam|ji|haan|nahin)\b/.test(text)) {
      return "HINDI";
    }
    
    // Check for common Telugu words in Roman script  
    if (/\b(namaskaram|meeru|ela|unnaru|nenu|peru|avunu|kaadu)\b/.test(text)) {
      return "TELUGU";
    }
    
    // Default to English for Latin script
    return "ENGLISH";
  }
}