import jwt from "jsonwebtoken";
import { INVITE_JWT_SECRET, SECRET } from "./env";
import { IUserToken } from "./interface";
import rateLimit from "express-rate-limit";
import { Response } from "express";

export const generateToken = (user: IUserToken): string => {
  const token = jwt.sign(user, SECRET, {
    expiresIn: "1h",
    issuer: "wms-api",
    audience: "wms-app",
  });
  return token;
};

export const getUserData = (token: string) => {
  const user = jwt.verify(token, SECRET) as IUserToken;

  return user;
};

export const generateRefreshToken = (): string => {
  const refreshToken = jwt.sign({}, SECRET, {
    expiresIn: "7d",
  });
  return refreshToken;
};

export const generateInviteToken = (payload: { sub: string; email: string }): string => {
  return jwt.sign(payload, INVITE_JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const verifyInviteToken = (token: string): { sub: string; email: string } => {
  return jwt.verify(token, INVITE_JWT_SECRET) as { sub: string; email: string };
};

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    return `${req.ip}_${req.body.email || ""}`; // Use the IP address of the request as the key
  },
});

export const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Set to true in production
    sameSite: "strict", // Adjust based on your requirements
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
};
