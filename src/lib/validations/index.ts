/**
 * All Zod schemas live here and are shared between the frontend (React Hook
 * Form resolvers) and the API routes (Rule #6). Add feature schemas as their
 * own files (e.g. `auth.ts`, `candidate.ts`) and re-export them below.
 */
export * from "./common";
export * from "./auth.schemas";
