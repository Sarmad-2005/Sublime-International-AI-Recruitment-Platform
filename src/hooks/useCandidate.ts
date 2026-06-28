"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  ApiResponse,
  CandidateProfileDTO,
  ProfileCompletion,
} from "@/types";
import type { UpdateCandidateProfileInput } from "@/lib/validations";
import type { CandidateProfilePayload } from "@/app/api/candidate/profile/route";

/**
 * Candidate profile client hooks (Rule #4). They wrap the
 * `/api/candidate/profile` endpoint with TanStack Query so components get
 * caching, loading/error state and an optimistic-friendly update mutation
 * without holding any business logic themselves.
 *
 * Requires `QueryProvider` higher in the tree (mounted in the candidate layout).
 */

export const candidateProfileKey = ["candidate", "profile"] as const;

async function fetchProfile(): Promise<CandidateProfilePayload> {
  const res = await fetch("/api/candidate/profile", { cache: "no-store" });
  const json = (await res.json()) as ApiResponse<CandidateProfilePayload>;
  if (!json.success) {
    throw new Error(json.error.message);
  }
  return json.data;
}

async function patchProfile(
  input: UpdateCandidateProfileInput,
): Promise<CandidateProfilePayload> {
  const res = await fetch("/api/candidate/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as ApiResponse<CandidateProfilePayload>;
  if (!json.success) {
    throw new Error(json.error.message);
  }
  return json.data;
}

/**
 * Fetch + cache the candidate's profile and expose a section-save mutation.
 * On a successful save the cache is updated in place so completion meters and
 * any consumer re-render immediately.
 */
export function useCandidateProfile() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: candidateProfileKey,
    queryFn: fetchProfile,
  });

  const mutation = useMutation({
    mutationFn: patchProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(candidateProfileKey, data);
    },
  });

  return {
    profile: query.data?.profile ?? null,
    completion: query.data?.completion ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,

    /** Save one profile section (partial). Resolves with the fresh payload. */
    updateProfile: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    updateError: mutation.error,
  };
}

const EMPTY_COMPLETION: ProfileCompletion = {
  overall: 0,
  sections: {
    personal: { percentage: 0, missingFields: [] },
    documents: { percentage: 0, missingFields: [] },
    education: { percentage: 0, missingFields: [] },
  },
  missingFields: [],
};

/**
 * The candidate's profile completion — overall percentage, per-section
 * breakdown and the flat list of missing fields. Reuses the cached profile
 * query, so it's cheap to call alongside `useCandidateProfile`.
 */
export function useProfileCompletion() {
  const query = useQuery({
    queryKey: candidateProfileKey,
    queryFn: fetchProfile,
  });

  const completion = query.data?.completion ?? EMPTY_COMPLETION;

  return {
    percentage: completion.overall,
    sections: completion.sections,
    missingFields: completion.missingFields,
    isComplete: completion.overall === 100,
    isLoading: query.isLoading,
  };
}

/** Re-export for convenience when a component needs the raw DTO type. */
export type { CandidateProfileDTO };
