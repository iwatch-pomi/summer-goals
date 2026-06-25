import { PrismaClient } from "@prisma/client";

// Next.js のホットリロードで PrismaClient が大量生成されないよう
// グローバルにシングルトンを保持する（公式推奨パターン）。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
