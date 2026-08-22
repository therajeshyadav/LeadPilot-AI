import type { ErrorRequestHandler, RequestHandler } from "express";

import { isAppError } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${request.method} ${request.path} was not found.`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (isAppError(error)) {
    request.log.warn({ code: error.code, statusCode: error.statusCode }, error.message);
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.code === "VALIDATION_ERROR" ? { details: error.details } : {}),
      },
    });
    return;
  }

  request.log.error({ err: error }, "Unhandled request error");

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};
