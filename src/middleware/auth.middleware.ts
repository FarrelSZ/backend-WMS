import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import response from "../utils/response";
import { getUserData } from "../utils/jwt";
import { IReqUser } from "../utils/interface";

export default {
  authenticated(req: Request, res: Response, next: NextFunction) {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return response.unauthorized(res);
    }

    const [prefix, token, ...extra] = authorization.trim().split(/\s+/);

    if (prefix !== "Bearer" || !token || extra.length > 0) {
      return response.unauthorized(res);
    }

    try {
      const user = getUserData(token);
      (req as IReqUser).user = user;
      return next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return response.unauthorized(res, "Access token Anda telah kadaluwarsa.");
      }

      return response.unauthorized(res, "Access token tidak valid atau telah dirusak.");
    }
  },
};
