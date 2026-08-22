import type { AppConfig } from "./env.js";
import { createConfiguredServices } from "./service-factory.js";
import { createPrismaRepositories } from "../repositories/prisma-repositories.js";
import type { AppServices } from "../services/service-factory.js";

export interface RuntimeDependencies {
  services: AppServices;
  disconnect(): Promise<void>;
}

export function createRuntimeDependencies(config: AppConfig): RuntimeDependencies {
  const database = config.DATABASE_URL ? createPrismaRepositories(config.DATABASE_URL) : undefined;
  const services = createConfiguredServices(config);

  return {
    services,
    disconnect: async () => database?.prisma.$disconnect(),
  };
}
