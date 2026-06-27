"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { extractUserRole } from "@/lib/supabase/roles";
import { useAuthStore } from "@/stores/auth.store";
import {
  AUTH_REDIRECT_PARAM,
  ROLE_HOME_ROUTE,
  ROUTES,
  type UserRole,
} from "@/lib/constants";
import type { CandidateProfileSummary, MeResponse } from "@/types";

/**
 * Client auth hooks. They sync the Zustand auth store with the live Supabase
 * session and expose ergonomic helpers for components. These guard the UI only
 * — the middleware and services enforce real authorization on the server.
 */

/**
 * Subscribe the auth store to the Supabase session and expose the current user.
 * Mounting this once near the app root keeps the store live for the whole tree.
 */
export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    const apply = (supabaseUser: SupabaseUser | null) => {
      if (!active) return;
      if (!supabaseUser) {
        clearUser();
        return;
      }
      const resolvedRole = extractUserRole(supabaseUser);
      if (resolvedRole) {
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email ?? undefined,
          role: resolvedRole,
        });
      } else {
        // Authenticated but no resolvable role — treat as signed out for the UI.
        clearUser();
      }
    };

    // Validate against the auth server once on mount…
    void supabase.auth.getUser().then(({ data }) => apply(data.user));

    // …then react to future sign-in / sign-out / token-refresh events.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setUser, clearUser]);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    clearUser();
  }, [clearUser]);

  return { user, role, isLoading, signOut };
}

/**
 * Client-side guard: redirect to login when unauthenticated, or to the user's
 * own dashboard when their role is not in `requiredRole`. Returns the auth state
 * so the calling screen can render a loader while it resolves.
 */
export function useRequireAuth(requiredRole?: UserRole | UserRole[]) {
  const { user, role, isLoading, signOut } = useAuth();
  const router = useRouter();

  // Stable key so the effect doesn't re-run on every render for an inline array.
  const allowedRoles = useMemo<UserRole[] | null>(() => {
    if (!requiredRole) return null;
    return Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  }, [requiredRole]);

  useEffect(() => {
    if (isLoading) return;

    if (!user || !role) {
      const target =
        typeof window !== "undefined" ? window.location.pathname : ROUTES.HOME;
      router.replace(
        `${ROUTES.LOGIN}?${AUTH_REDIRECT_PARAM}=${encodeURIComponent(target)}`,
      );
      return;
    }

    if (allowedRoles && !allowedRoles.includes(role)) {
      router.replace(ROLE_HOME_ROUTE[role]);
    }
  }, [user, role, isLoading, allowedRoles, router]);

  return { user, role, isLoading, signOut };
}

/**
 * The signed-in candidate's profile summary (or `null`). Disabled for non-
 * candidate roles. Requires a TanStack Query provider higher in the tree.
 */
export function useCurrentCandidate() {
  const { user, role, isLoading: isAuthLoading } = useAuth();

  const query = useQuery<MeResponse, Error, CandidateProfileSummary | null>({
    queryKey: ["auth", "me", user?.id],
    enabled: !isAuthLoading && !!user && role === "CANDIDATE",
    queryFn: async () => {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load your candidate profile.");
      }
      return (await response.json()) as MeResponse;
    },
    select: (data) => data.candidate,
  });

  return {
    candidate: query.data ?? null,
    isLoading: isAuthLoading || query.isLoading,
    error: query.error,
  };
}
