import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { DATABASE_URL } from "../utils/env";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const url = new URL(DATABASE_URL);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  connectionLimit: 5,
  ssl: url.protocol === "mariadb+ssl:" ? { rejectUnauthorized: true } : {},
});

export const prisma = new PrismaClient({ adapter });
