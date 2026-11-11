import * as repoAuth from "../repository/auth.repository";
import { hashPassword, verifyPassword } from "../../utils/encryption";
import { generateRefreshToken, generateToken, verifyInviteToken } from "../../utils/jwt";
import { AppError } from "../../utils/error";

export const login = async (email: string, password: string) => {
  const user = await repoAuth.findUserByEmail(email);

  if (!user || user.status === "suspended") {
    return { status: 401 as const, message: "Login Gagal", optional: ["Email atau kata sandi salah."] };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { status: 429 as const, message: "Akun Terkunci", optional: ["Akun dikunci sementara."] };
  }

  const isValid = await verifyPassword(user.passwordHash, password);
  if (!isValid) {
    const newCount = user.failedLoginCount + 1;
    const lockedUntil = newCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await repoAuth.updateFailedLogin(user.id, newCount, lockedUntil);
    return { status: 401 as const, message: "Login Gagal", optional: ["Email atau kata sandi salah."] };
  }

  await repoAuth.resetFailedLogin(user.id);

  const role = user.roles[0]?.role.code;
  if (!role) {
    throw new AppError(403, "Akun belum memiliki role");
  }

  const accessToken = generateToken({
    id: user.id.toString(),
    role,
  });

  const refreshToken = generateRefreshToken();

  return {
    status: 200 as const,
    message: "Login berhasil",
    accessToken,
    refreshToken,
    user: {
      id: user.id.toString(),
      email: user.email,
      fullName: user.fullName,
    },
  };
};

export const refresh = async (refreshToken: string) => {
  if (!refreshToken) {
    throw new AppError(401, "Refresh token tidak ditemukan");
  }
  const existingToken = await repoAuth.findRefreshToken(refreshToken);
  if (!existingToken) {
    throw new AppError(401, "Refresh token tidak valid");
  }

  if (existingToken.replacedById || existingToken.revokedAt) {
    await repoAuth.revokeAllUserRefreshTokens(existingToken.userId);
    throw new AppError(401, "Sesi mencurigakan terdeteksi (Token Reuse). Seluruh sesi dicabut.");
  }

  if (existingToken.expiresAt < new Date()) {
    throw new AppError(401, "Refresh token telah kedaluwarsa");
  }

  const role = existingToken.user.roles[0]?.role.code;
  if (!role) {
    throw new AppError(403, "Akun belum memiliki role");
  }

  const newRefreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await repoAuth.rotateRefreshToken(existingToken.id, newRefreshToken, existingToken.userId, expiresAt);
  const accessToken = generateToken({
    id: existingToken.userId.toString(),
    role,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

export const logout = async (refreshToken: string) => {
  if (refreshToken) {
    const token = await repoAuth.findRefreshToken(refreshToken);
    if (token) await repoAuth.revokeToken(token.id);
  }
};

export const logoutAll = async (userId: string) => {
  await repoAuth.revokeAllUserRefreshTokens(BigInt(userId));
};

export const getMe = async (userId: string) => {
  const user = await repoAuth.findUserById(BigInt(userId));
  if (!user) {
    throw new AppError(404, "User tidak ditemukan");
  }

  const roles = user.roles.map((r) => r.role.code);
  const permission = Array.from(new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code))));
  const warehouses = user.warehouses.map((wh) => ({
    id: wh.warehouse.id.toString(),
    code: wh.warehouse.code,
    name: wh.warehouse.name,
  }));

  return {
    id: user.id.toString(),
    email: user.email,
    fullName: user.fullName,
    roles,
    permission,
    warehouses,
  };
};

export const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  const user = await repoAuth.findUserById(BigInt(userId));
  if (!user) {
    throw new AppError(404, "User tidak ditemukan");
  }

  const isValid = await verifyPassword(user.passwordHash, oldPassword);
  if (!isValid) {
    throw new AppError(401, "Kata sandi lama salah");
  }

  const newHash = await hashPassword(newPassword);
  await repoAuth.updateUserPassword(BigInt(userId), newHash);
  await repoAuth.revokeAllUserRefreshTokens(BigInt(userId));
};

export const acceptInvite = async (inviteToken: string, password: string) => {
  const decoded = await verifyInviteToken(inviteToken);
  const user = await repoAuth.findUserById(BigInt(decoded.sub));
  if (!user || user.status !== "invited") {
    throw new AppError(400, "Token undangan tidak valid atau telah kedaluwarsa");
  }

  const hash = await hashPassword(password);
  await repoAuth.updateUserPassword(user.id, hash);
};
