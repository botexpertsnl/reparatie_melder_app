import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  return new PrismaClient();
}

const fallbackClient = new Proxy(
  {},
  {
    get() {
      throw new Error("Prisma client is unavailable: DATABASE_URL is not configured");
    }
  }
) as PrismaClient;

export const prisma =
  globalForPrisma.prisma ??
  (process.env.DATABASE_URL ? createPrismaClient() : fallbackClient);

if (process.env.NODE_ENV !== "production" && process.env.DATABASE_URL) {
  globalForPrisma.prisma = prisma;
}
