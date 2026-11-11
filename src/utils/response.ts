import { Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client";
import { pagination } from "./interface";

const buildResponse = <T>(status: number, message: string, data: T | null = null, optional: any[] = []) => ({
  status,
  meta: {
    status,
    message,
    ...(optional.length ? { optional } : {}),
  },
  data,
});

export default {
  send(res: Response, payload: ReturnType<typeof buildResponse>) {
    return res.status(payload.status).json(payload);
  },

  success(res: Response, data: any, message: string = "success", optional: any[] = []) {
    const payload = buildResponse(200, message, data, optional);
    return res.status(200).json(payload);
  },

  error(res: Response, error: unknown, message?: string) {
    if (error instanceof ZodError) {
      const formattedErrors: Record<string, string> = {};
      error.issues.forEach((issue) => {
        formattedErrors[issue.path.join(".")] = issue.message;
      });

      const payload = buildResponse(400, "Validation error", null, [formattedErrors]);
      return res.status(400).json(payload);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = (error.meta?.target as string[])?.join(", ") || "field";
        const payload = buildResponse(400, `Data dengan ${target} tersebut sudah terdaftar`, null, [error.meta ?? {}]);
        return res.status(400).json(payload);
      }

      if (error.code === "P2025") {
        const payload = buildResponse(404, "Data tidak ditemukan di database", null);
        return res.status(404).json(payload);
      }
    }

    const errorMessage = error instanceof Error ? error.message : "Interval server error";
    const payload = buildResponse(
      500,
      message ?? errorMessage,
      null,
      process.env.NODE_ENV === "development" ? [error] : [],
    );
    return res.status(500).json(payload);
  },

  notFound(res: Response, message: string = "not found") {
    return res.status(404).json(buildResponse(404, message, null));
  },

  unauthorized(res: Response, message: string = "unauthorized", optional: any[] = []) {
    return res.status(401).json(buildResponse(401, message, null, optional));
  },

  tooManyRequests(res: Response, message: string = "too many requests", optional: any[] = []) {
    return res.status(429).json(buildResponse(429, message, null, optional));
  },

  forbidden(res: Response, message: string = "forbidden") {
    return res.status(403).json(buildResponse(403, message, null));
  },

  pagination(res: Response, data: any[], pagination: pagination, message: string) {
    return res.status(200).json({
      meta: {
        status: 200,
        message,
      },
      data,
      pagination,
    });
  },
};
