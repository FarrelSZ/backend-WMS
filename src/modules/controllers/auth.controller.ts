import { Request, Response } from "express";
import { setRefreshTokenCookie } from "../../utils/jwt";
import * as authService from "../services/auth.service";
import response from "../../utils/response";
import { IReqUser } from "../../utils/interface";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    if (result.status === 401) {
      return response.unauthorized(res, result.message, result.optional);
    }

    if (result.status === 429) {
      return response.tooManyRequests(res, result.message, result.optional);
    }

    setRefreshTokenCookie(res, result.refreshToken);

    return response.success(
      res,
      { accessToken: result.accessToken, expiresIn: 900, user: result.user },
      result.message,
    );
  } catch (err) {
    return response.error(res, err, "Gagal melakukan login");
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refresh_token;
    const result = await authService.refresh(token);
    setRefreshTokenCookie(res, result.refreshToken);

    return response.success(
      res,
      {
        accessToken: result.accessToken,
        expiresIn: 900,
      },
      "Refresh Token Berhasil",
    );
  } catch (error) {
    return response.error(res, error, "Gagal melakukan refresh token");
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    await authService.logout(req.cookies?.refresh_token);
    res.clearCookie("refresh_token", { path: "/" });

    return response.success(res, null, "Logout berhasil");
  } catch (error) {
    return response.error(res, error, "Gagal logout");
  }
};

export const logoutAll = async (req: IReqUser, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return response.unauthorized(res);
    }

    await authService.logoutAll(userId);
    res.clearCookie("refresh_token", { path: "/" });
    return response.success(res, null, "Logout semua sesi berhasil");
  } catch (error) {
    return response.error(res, error, "Gagal logout semua sesi");
  }
};

export const me = async (req: IReqUser, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return response.unauthorized(res);
    }

    const result = await authService.getMe(userId);
    return response.success(res, result, "Data user berhasil diambil");
  } catch (error) {
    return response.error(res, error);
  }
};

export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const token = req.body.token;
    const password = req.body.password;
    await authService.acceptInvite(token, password);
  } catch (error) {
    return response.error(res, error, "Gagal menerima undangan");
  }
};
