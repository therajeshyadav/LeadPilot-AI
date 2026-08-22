export interface WhatsAppTextRequest {
  to: string;
  body: string;
  idempotencyKey: string;
}

export interface WhatsAppMediaRequest extends WhatsAppTextRequest {
  mediaUrl: string;
}

export interface WhatsAppSendResult {
  providerMessageId: string;
}

export interface WhatsAppProvider {
  readonly name: string;
  sendText(request: WhatsAppTextRequest): Promise<WhatsAppSendResult>;
  sendMedia(request: WhatsAppMediaRequest): Promise<WhatsAppSendResult>;
}
