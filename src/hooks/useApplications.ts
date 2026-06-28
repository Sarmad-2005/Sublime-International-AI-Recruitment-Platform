"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  ApiError,
  ApiResponse,
  ApplicationDetailDTO,
  ApplicationListItem,
} from "@/types";
import type { CreateApplicationInput } from "@/lib/validations";

/**
 * Application client hooks (Rule #4) — wrap the `/api/applications` endpoints
 * with TanStack Query. The `ApplyModal` calls `useCreateApplication`; the
 * detail page can hydrate from `useApplication`.
 *
 * Requires `QueryProvider` higher in the tree (mounted in the candidate layout).
 */

export const applicationsKey = ["applications"] as const;
export const applicationKey = (id: string) =>
  ["applications", id] as const;

/** Thrown by the create mutation so callers can branch on the API error code. */
export class CreateApplicationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CreateApplicationError";
  }
}

async function fetchApplications(): Promise<ApplicationListItem[]> {
  const res = await fetch("/api/applications", { cache: "no-store" });
  const json = (await res.json()) as ApiResponse<ApplicationListItem[]>;
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

async function fetchApplication(id: string): Promise<ApplicationDetailDTO> {
  const res = await fetch(`/api/applications/${id}`, { cache: "no-store" });
  const json = (await res.json()) as ApiResponse<ApplicationDetailDTO>;
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

async function postApplication(
  input: CreateApplicationInput,
): Promise<ApplicationListItem> {
  const res = await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as ApiResponse<ApplicationListItem>;
  if (!json.success) {
    const err = (json as ApiError).error;
    throw new CreateApplicationError(err.message, err.code, err.details);
  }
  return json.data;
}

/** The signed-in candidate's applications (newest first). */
export function useApplications(initialData?: ApplicationListItem[]) {
  const query = useQuery({
    queryKey: applicationsKey,
    queryFn: fetchApplications,
    initialData,
  });

  return {
    applications: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Full detail for a single application. */
export function useApplication(
  id: string,
  initialData?: ApplicationDetailDTO,
) {
  const query = useQuery({
    queryKey: applicationKey(id),
    queryFn: () => fetchApplication(id),
    initialData,
  });

  return {
    application: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

/**
 * Submit a new application. On success the cached applications list is
 * invalidated so "My Applications" reflects the new entry immediately.
 */
export function useCreateApplication() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: postApplication,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: applicationsKey });
    },
  });

  return {
    createApplication: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    error: mutation.error as CreateApplicationError | null,
    reset: mutation.reset,
  };
}
