"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ApiResponse, JobBoardQuery, JobBoardResult } from "@/types";
import { jobBoardSearchParams } from "@/lib/utils/jobs";

/**
 * Job Board client hook (Rule #4). Wraps `GET /api/jobs` with TanStack Query so
 * the filters/search UI gets caching + loading state and updates the visible
 * list without a full page reload. The Server Component seeds `initialData` for
 * the first (SSR'd, URL-driven) render, so the first paint never flashes empty.
 *
 * Requires `QueryProvider` higher in the tree (mounted in the candidate layout).
 */

// Re-exported so client callers can keep importing it from `@/hooks`.
export { jobBoardSearchParams };

export const jobsKey = (query: JobBoardQuery) =>
  ["jobs", query] as const;

async function fetchJobs(query: JobBoardQuery): Promise<JobBoardResult> {
  const qs = jobBoardSearchParams(query);
  const res = await fetch(`/api/jobs${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as ApiResponse<JobBoardResult>;
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

export function useJobs(query: JobBoardQuery, initialData?: JobBoardResult) {
  const result = useQuery({
    queryKey: jobsKey(query),
    queryFn: () => fetchJobs(query),
    initialData,
    placeholderData: keepPreviousData,
  });

  return {
    data: result.data,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isError: result.isError,
    error: result.error,
  };
}
