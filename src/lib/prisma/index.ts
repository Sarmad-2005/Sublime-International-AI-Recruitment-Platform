/**
 * Barrel export for the Prisma module.
 *
 * Import the server-only client and generated types/enums from one place:
 *
 *   import { prisma, type User, UserRole } from "@/lib/prisma";
 *
 * `prisma` is server-only (it pulls in `server-only` via ./client), so this
 * module must not be imported from client components. For enum/type values in
 * the browser, import from `@/generated/prisma/enums` directly instead.
 */
export { prisma } from "./client";

// Re-exports model types, the `Prisma` namespace, the `PrismaClient` class, and
// every generated enum (UserRole, JobStatus, …) — this generated entrypoint
// already re-exports `./enums` internally.
export * from "@/generated/prisma/client";
