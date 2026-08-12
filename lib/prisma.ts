import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) return null;

  try {
    const url = new URL(value);
    const usesSupabaseTransactionPooler =
      url.hostname.endsWith(".pooler.supabase.com") || url.port === "6543";

    if (usesSupabaseTransactionPooler) {
      url.searchParams.set("pgbouncer", "true");
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
    }

    return url.toString();
  } catch {
    return value;
  }
}

const databaseUrl = getDatabaseUrl();

function createPrismaClient(url: string) {
  return new PrismaClient({ datasources: { db: { url } } });
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
  (databaseUrl ? createPrismaClient(databaseUrl) : fallbackClient);

if (process.env.NODE_ENV !== "production" && databaseUrl) {
  globalForPrisma.prisma = prisma;
}
