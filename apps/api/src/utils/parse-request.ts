import { z } from "zod";

import { ValidationError } from "./errors.js";

export function parseRequest<TSchema extends z.ZodTypeAny>(schema: TSchema, input: unknown): z.output<TSchema> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  throw new ValidationError("Request validation failed.", parsed.error.flatten());
}
