/**
 * Service layer — the ONLY place that talks to the database (Rule #5).
 *
 * Each domain gets its own file (e.g. `candidate.service.ts`) exporting pure
 * async functions that use the Prisma client from `@/lib/prisma`. Components
 * never query the DB directly; they call hooks, which call these services.
 * Re-export each service module here as it is added.
 */
export {};
