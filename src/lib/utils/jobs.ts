import type { JobBoardQuery } from "@/types";

/**
 * Canonical `/api/jobs` query string for a (partial) Job Board query. Shared by
 * the Server Component page and the `useJobs` client hook so both agree on the
 * exact string — which is how the page decides whether its SSR'd data can seed
 * React Query's cache for the first render.
 *
 * Lives outside the (client-only) hooks module so the server can call it too.
 */
export function jobBoardSearchParams(query: Partial<JobBoardQuery>): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.sector) params.set("sector", query.sector);
  if (query.country) params.set("country", query.country);
  if (query.salaryMin != null) params.set("salaryMin", String(query.salaryMin));
  if (query.postedWithinDays != null)
    params.set("postedWithinDays", String(query.postedWithinDays));
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params.toString();
}
