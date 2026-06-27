import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * Prisma client singleton (Prisma 7 + driver adapter).
 *
 * Prisma 7 no longer reads the connection URL from the schema; the runtime
 * client connects through a driver adapter. We use `@prisma/adapter-pg` against
 * the pooled Supabase `DATABASE_URL`.
 *
 * The instance is cached on `globalThis` in development so Next.js hot-reloads
 * don't exhaust the connection pool. All DB access must go through the service
 * layer in `@/lib/services` (Rule #5), which imports this client.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: serverEnv.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log:
      serverEnv.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (serverEnv.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
