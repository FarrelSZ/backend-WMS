import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/error";
import response from "../utils/response";

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    switch (err.statusCode) {
      case 401:
        return response.unauthorized(res, err.message, err.optional);
      case 403:
        return response.forbidden(res, err.message);
      case 404:
        return response.notFound(res, err.message);
      case 429:
        return response.tooManyRequests(res, err.message, err.optional);
      default:
        return response.error(res, err, err.message);
    }
  }

  // Fallback untuk ZodError, PrismaError, dan 500
  return response.error(res, err);
};
