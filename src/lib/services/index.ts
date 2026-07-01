/**
 * Service layer — the ONLY place that talks to the database (Rule #5).
 *
 * Each domain gets its own file (e.g. `candidate.service.ts`) exporting pure
 * async functions that use the Prisma client from `@/lib/prisma`. Components
 * never query the DB directly; they call hooks, which call these services.
 * Re-export each service module here as it is added.
 *
 * Services are namespaced (`authService.signIn(...)`) to keep call sites
 * self-documenting and avoid name collisions between domains.
 */
export * as adminService from "./admin.service";
export * as authService from "./auth.service";
export * as candidateService from "./candidate.service";
export * as jobService from "./job.service";
export * as applicationService from "./application.service";
export * as assessmentService from "./assessment.service";
export * as interviewService from "./interview.service";
export * as tierService from "./tier.service";
export * as jobPostService from "./jobPost.service";
