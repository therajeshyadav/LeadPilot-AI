import type { WhatsAppProvider, WhatsAppTextRequest, WhatsAppMediaRequest, WhatsAppSendResult } from "./whatsapp-provider.js";

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string; // e.g., "whatsapp:+14155238886"
}

interface TwilioMessageResponse {
  sid: string;
  status: string;
  error_code?: string;
  error_message?: string;
}

export class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly name = "twilio";
  private readonly config: TwilioConfig;
  private readonly baseURL: string;

  constructor(config: TwilioConfig) {
    this.config = config;
    this.baseURL = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  }

  async sendText(request: WhatsAppTextRequest): Promise<WhatsAppSendResult> {
    try {
      console.log(`🔵 Twilio sendText called`);
      console.log(`   To: ${request.to}`);
      console.log(`   Body length: ${request.body?.length || 0} chars`);
      console.log(`   Body preview: ${request.body?.substring(0, 100)}...`);
      
      const response = await this.makeRequest({
        To: this.formatPhoneNumber(request.to),
        From: this.config.fromNumber,
        Body: request.body,
      });

      if (response.error_code) {
        throw new Error(`Twilio error ${response.error_code}: ${response.error_message}`);
      }

      console.log(`✅ Twilio message sent successfully - SID: ${response.sid}, Status: ${response.status}`);

      return {
        providerMessageId: response.sid,
      };
    } catch (error) {
      console.error(`❌ Twilio sendText failed:`, error);
      throw new Error(`Failed to send WhatsApp message: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async sendMedia(request: WhatsAppMediaRequest): Promise<WhatsAppSendResult> {
    try {
      console.log(`🔵 Twilio sendMedia called`);
      console.log(`   To: ${request.to}`);
      console.log(`   Body length: ${request.body?.length || 0} chars`);
      console.log(`   Body preview: ${request.body?.substring(0, 100) || '(empty)'}${request.body && request.body.length > 100 ? '...' : ''}`);
      console.log(`   Media URL: ${request.mediaUrl}`);
      
      const response = await this.makeRequest({
        To: this.formatPhoneNumber(request.to),
        From: this.config.fromNumber,
        Body: request.body || "", // Ensure body is at least empty string
        MediaUrl: request.mediaUrl,
      });

      if (response.error_code) {
        throw new Error(`Twilio error ${response.error_code}: ${response.error_message}`);
      }

      console.log(`✅ Twilio media message sent successfully - SID: ${response.sid}, Status: ${response.status}`);

      return {
        providerMessageId: response.sid,
      };
    } catch (error) {
      console.error(`❌ Twilio sendMedia failed:`, error);
      throw new Error(`Failed to send WhatsApp media message: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async makeRequest(body: Record<string, string>): Promise<TwilioMessageResponse> {
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');
    
    const formData = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      formData.append(key, value);
    });

    console.log('🔵 Twilio WhatsApp Request:', { to: body.To, from: body.From });

    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await response.text();
    console.log('🔵 Twilio Response:', { status: response.status, body: responseText });
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.detail || errorMessage;
        console.error('🔴 Twilio Error Details:', errorData);
      } catch {
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response from Twilio: ${responseText}`);
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Ensure phone number is in WhatsApp format
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('whatsapp:')) {
      return cleaned;
    }
    
    if (cleaned.startsWith('+')) {
      return `whatsapp:${cleaned}`;
    }
    
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `whatsapp:+${cleaned}`;
    }
    
    return `whatsapp:+91${cleaned}`;
  }
}