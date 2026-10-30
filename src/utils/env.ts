import dotenv from "dotenv";

dotenv.config();

export const SECRET: string = process.env.SECRET || "";
export const PORT: number = Number(process.env.PORT) || 3000;
export const DATABASE_URL: string = process.env.DATABASE_URL || "";
export const DATABASE_USER: string = process.env.DATABASE_USER || "";
export const DATABASE_PASSWORD: string = process.env.DATABASE_PASSWORD || "";
export const DATABASE_NAME: string = process.env.DATABASE_NAME || "";
export const DATABASE_HOST: string = process.env.DATABASE_HOST || "";
export const DATABASE_PORT: number = Number(process.env.DATABASE_PORT) || 3306;
