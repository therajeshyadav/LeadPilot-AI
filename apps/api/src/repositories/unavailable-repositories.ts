import { IntegrationUnavailableError } from "../utils/errors.js";
import type { Repositories } from "./contracts.js";

/** Keeps health checks online when PostgreSQL is intentionally not configured. */
export function createUnavailableRepositories(): Repositories {
  const fail = () => Promise.reject(new IntegrationUnavailableError("PostgreSQL database"));
  const unavailable = new Proxy({}, { get: () => fail });

  return {
    leads: unavailable as Repositories["leads"],
    conversations: unavailable as Repositories["conversations"],
    callbacks: unavailable as Repositories["callbacks"],
    whatsappMessages: unavailable as Repositories["whatsappMessages"],
    qualifications: unavailable as Repositories["qualifications"],
  };
}
