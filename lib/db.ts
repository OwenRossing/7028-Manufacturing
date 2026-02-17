import { PrismaClient } from "@prisma/client";
import { isProductionMode } from "@/lib/app-mode";

if (isProductionMode() && process.env.DATABASE_URL_PRODUCTION) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_PRODUCTION;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
