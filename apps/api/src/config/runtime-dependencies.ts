import type { AppConfig } from "./env.js";
import { UnavailableWhatsAppProvider } from "../integrations/whatsapp/unavailable-whatsapp-provider.js";
import { createPrismaRepositories } from "../repositories/prisma-repositories.js";
import { createUnavailableRepositories } from "../repositories/unavailable-repositories.js";
import { createServices, type AppServices } from "../services/service-factory.js";

export interface RuntimeDependencies {
  services: AppServices;
  disconnect(): Promise<void>;
}

export function createRuntimeDependencies(config: AppConfig): RuntimeDependencies {
  const database = config.DATABASE_URL ? createPrismaRepositories(config.DATABASE_URL) : undefined;
  const services = createServices({
    repositories: database?.repositories ?? createUnavailableRepositories(),
    // Twilio is added as the concrete provider in the WhatsApp integration phase.
    whatsappProvider: new UnavailableWhatsAppProvider(),
  });

  return {
    services,
    disconnect: async () => database?.prisma.$disconnect(),
  };
}
