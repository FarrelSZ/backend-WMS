import { prisma } from "../../lib/prisma";

export const findUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email, status: "active", deletedAt: null },
    include: {
      roles: { include: { role: true } },
    },
  });
};

export const findUserById = async (id: bigint) => {
  return prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
      warehouses: { include: { warehouse: true } },
    },
  });
};

export const updateFailedLogin = async (userId: bigint, count: number, lockedUntil: Date | null) => {
  return prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: count, lockedUntil },
  });
};

export const resetFailedLogin = async (userId: bigint) => {
  return prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
};

export const createRefreshToken = async (userId: bigint, token: string, expiresAt: Date) => {
  return prisma.refreshToken.create({
    data: { userId, tokenHash: token, expiresAt },
  });
};

export const findRefreshToken = async (token: string) => {
  return prisma.refreshToken.findUnique({
    where: { tokenHash: token },
    include: {
      user: {
        include: {
          roles: { include: { role: true } },
        },
      },
    },
  });
};

export const rotateRefreshToken = async (oldTokenId: bigint, newToken: string, userId: bigint, expiresAt: Date) => {
  return prisma.$transaction(async (tx) => {
    const createdToken = await tx.refreshToken.create({
      data: { userId, tokenHash: newToken, expiresAt },
    });
    await tx.refreshToken.update({
      where: { id: oldTokenId },
      data: { replacedById: createdToken.id, revokedAt: new Date() },
    });
    return createdToken;
  });
};

export const revokeToken = async (id: bigint) => {
  return prisma.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
};

export const revokeAllUserRefreshTokens = async (userId: bigint) => {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const updateUserPassword = async (userId: bigint, passwordHash: string) => {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash, status: "active" },
  });
};
