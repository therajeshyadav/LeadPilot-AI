export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", 400, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", 404, `${resource} was not found.`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", 409, message, details);
  }
}

export class IntegrationUnavailableError extends AppError {
  constructor(integration: string) {
    super("INTEGRATION_UNAVAILABLE", 503, `${integration} is not configured or currently unavailable.`);
  }
}

export class IntegrationFailureError extends AppError {
  constructor(integration: string, cause?: unknown) {
    super("INTEGRATION_FAILURE", 502, `${integration} could not complete the requested operation.`, cause);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
