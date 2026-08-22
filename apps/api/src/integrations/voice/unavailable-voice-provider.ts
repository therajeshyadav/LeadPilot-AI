import type { SupportedLanguage } from "@leadpilot/shared";
import type { VoiceProvider, OutboundCallRequest, VoiceCall, VoiceWebhookEvent } from "./voice-provider.js";

export class UnavailableVoiceProvider implements VoiceProvider {
  readonly name = "unavailable";

  async createOutboundCall(request: OutboundCallRequest): Promise<VoiceCall> {
    throw new Error("VOICE_PROVIDER_NOT_CONFIGURED: Voice provider integration required for outbound calls");
  }

  async endCall(providerCallId: string): Promise<void> {
    throw new Error("VOICE_PROVIDER_NOT_CONFIGURED: Voice provider not available");
  }

  async getCall(providerCallId: string): Promise<VoiceCall | null> {
    throw new Error("VOICE_PROVIDER_NOT_CONFIGURED: Voice provider not available");
  }

  async parseAndVerifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<VoiceWebhookEvent> {
    throw new Error("VOICE_PROVIDER_NOT_CONFIGURED: Voice provider not available");
  }
}