import { Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client";
import { pagination } from "./interface";

export default {
  success(res: Response, data: any, message: string) {
    res.status(200).json({
      meta: {
        status: 200,
        message: message,
      },
      data: data,
    });
  },

  error(res: Response, error: unknown, message: string) {
    // Handling Error validation with Zod
    if (error instanceof ZodError) {
      const formattedErrors: Record<string, string> = {};
      error.issues.forEach((issue) => {
        formattedErrors[issue.path.join(".")] = issue.message;
      });
      res.status(400).json({
        meta: {
          status: 400,
          message: "Validation error",
        },
        error: formattedErrors,
      });
    }

    // Error di Prisma(MySql)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // error untuk Unique Constraint Violation (misal: email kembar)
      if (error.code === "P2002") {
        const target = (error.meta?.target as string[])?.join(", ") || "field";
        res.status(400).json({
          meta: {
            status: 400,
            message: `Data dengan ${target} tersebut sudah terdaftar`,
          },
          error: error.meta,
        });
      }

      // error ketika data yang ingin di-update/delete tidak ditemukan
      if (error.code === "P2025") {
        res.status(404).json({
          meta: {
            status: 404,
            message: "Data tidak ditemukan di database",
          },
          error: null,
        });
      }

      // Error server
      const errorMessage = error instanceof Error ? error.message : "Interval server error";
      return res.status(500).json({
        meta: {
          status: 500,
          message: message || errorMessage,
        },
        error: process.env.NODE_ENV === "development" ? error : null,
      });
    }
  },

  notFound(res: Response, message: string = "not found") {
    res.status(404).json({
      meta: {
        status: 404,
        message: message,
      },
      data: null,
    });
  },

  unauthorized(res: Response, message: string = "unauthorized") {
    res.status(403).json({
      meta: {
        status: 403,
        message,
      },
      data: null,
    });
  },

  pagination(res: Response, data: any[], pagination: pagination, message: string) {
    res.status(200).json({
      meta: {
        status: 200,
        message,
      },
      data,
      pagination,
    });
  },
};
