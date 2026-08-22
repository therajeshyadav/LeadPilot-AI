import type {
  WhatsAppMediaRequest,
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppTextRequest,
} from "../src/integrations/whatsapp/whatsapp-provider.js";
import { createInMemoryRepositories } from "../src/repositories/in-memory-repositories.js";
import { createServices } from "../src/services/service-factory.js";

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock-whatsapp";
  readonly textRequests: WhatsAppTextRequest[] = [];
  readonly mediaRequests: WhatsAppMediaRequest[] = [];
  shouldFail = false;

  async sendText(request: WhatsAppTextRequest): Promise<WhatsAppSendResult> {
    this.textRequests.push(request);
    if (this.shouldFail) throw new Error("Provider failure");
    return { providerMessageId: `mock-text-${this.textRequests.length}` };
  }

  async sendMedia(request: WhatsAppMediaRequest): Promise<WhatsAppSendResult> {
    this.mediaRequests.push(request);
    if (this.shouldFail) throw new Error("Provider failure");
    return { providerMessageId: `mock-media-${this.mediaRequests.length}` };
  }
}

export function createTestServices(provider = new MockWhatsAppProvider()) {
  return {
    provider,
    services: createServices({
      repositories: createInMemoryRepositories(),
      whatsappProvider: provider,
    }),
  };
}
