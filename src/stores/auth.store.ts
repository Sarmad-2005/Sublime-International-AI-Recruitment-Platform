import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isUserRole, type UserRole } from "@/lib/constants";

/**
 * Client-side auth/session store (Zustand).
 *
 * This holds only what the UI needs to render role-aware chrome quickly — it is
 * NOT the source of truth for authorization. The server (middleware + auth
 * service) always re-validates. `useAuth` keeps this in sync with the live
 * Supabase session.
 */

export interface AuthUser {
  id: string;
  role: UserRole;
  /**
   * Not persisted to localStorage — hydrated from the live Supabase session by
   * `useAuth`. Treat as possibly-absent right after a cold load.
   */
  email?: string;
}

interface AuthState {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: AuthUser | null) => void;
  clearUser: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const AUTH_STORAGE_KEY = "siorp-auth";

/** Safely read the persisted `{ id, role }` user back out of storage. */
function readPersistedUser(persisted: unknown): AuthUser | null {
  if (typeof persisted !== "object" || persisted === null) return null;
  const user = (persisted as { user?: unknown }).user;
  if (typeof user !== "object" || user === null) return null;
  const { id, role } = user as { id?: unknown; role?: unknown };
  if (typeof id === "string" && isUserRole(role)) return { id, role };
  return null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      // Start "loading" until `useAuth` resolves the session on the client.
      isLoading: true,

      setUser: (user) =>
        set({
          user,
          role: user?.role ?? null,
          isAuthenticated: user !== null,
          isLoading: false,
        }),

      clearUser: () =>
        set({
          user: null,
          role: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Persist only the non-sensitive identifiers (id + role) — never email,
      // tokens or session. `role` / `isAuthenticated` are derived in `merge`.
      partialize: (state) => ({
        user: state.user
          ? { id: state.user.id, role: state.user.role }
          : null,
      }),
      // Rebuild the derived fields from the persisted user so the rehydrated
      // state is always internally consistent.
      merge: (persisted, current) => {
        const user = readPersistedUser(persisted);
        return {
          ...current,
          user,
          role: user?.role ?? null,
          isAuthenticated: user !== null,
        };
      },
    },
  ),
);
