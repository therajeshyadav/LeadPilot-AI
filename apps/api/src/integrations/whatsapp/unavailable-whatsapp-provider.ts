import type { WhatsAppMediaRequest, WhatsAppProvider, WhatsAppSendResult, WhatsAppTextRequest } from "./whatsapp-provider.js";
import { IntegrationUnavailableError } from "../../utils/errors.js";

/** Explicitly fails outbound sending when Twilio WhatsApp is not configured. */
export class UnavailableWhatsAppProvider implements WhatsAppProvider {
  readonly name = "unconfigured";

  sendText(_request: WhatsAppTextRequest): Promise<WhatsAppSendResult> {
    return Promise.reject(new IntegrationUnavailableError("WhatsApp provider"));
  }

  sendMedia(_request: WhatsAppMediaRequest): Promise<WhatsAppSendResult> {
    return Promise.reject(new IntegrationUnavailableError("WhatsApp provider"));
  }
}
