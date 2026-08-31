import type { AppConfig } from "./env.js";
import { createConfiguredServices } from "./service-factory.js";
import { createPrismaRepositories } from "../repositories/prisma-repositories.js";
import type { AppServices } from "../services/service-factory.js";
import { CallbackWorker } from "../workers/callback-worker.js";

export interface RuntimeDependencies {
  services: AppServices;
  callbackWorker?: CallbackWorker;
  disconnect(): Promise<void>;
}

export function createRuntimeDependencies(config: AppConfig): RuntimeDependencies {
  const database = config.DATABASE_URL ? createPrismaRepositories(config.DATABASE_URL) : undefined;
  const services = createConfiguredServices(config);

  // Create and start callback worker if voice provider is configured
  let callbackWorker: CallbackWorker | undefined;
  if (config.VOICE_API_KEY && config.VOICE_AGENT_ID && config.DATABASE_URL) {
    callbackWorker = new CallbackWorker(services.callbacks, 60); // Check every 60 seconds
    callbackWorker.start();
  } else {
    console.log("⚠️  Callback worker not started (requires VOICE_API_KEY, VOICE_AGENT_ID, and DATABASE_URL)");
  }

  return {
    services,
    callbackWorker,
    disconnect: async () => {
      callbackWorker?.stop();
      await database?.prisma.$disconnect();
    },
  };
}
