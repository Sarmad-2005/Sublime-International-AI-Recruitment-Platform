import "server-only";

import { authService } from "@/lib/services";
import { ADMIN_ROLES } from "@/lib/constants";

/**
 * Shared server-side guard + result type for admin Server Actions, so every
 * action re-checks the caller's role the same way and returns the same
 * serialisable shape (Rule #5 — auth is enforced server-side, UI guards are
 * convenience only).
 */

/** Serialisable discriminated union returned by every admin action. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Assert the caller is a signed-in admin / recruiter. Returns the user on
 * success; throws `Unauthorized` otherwise (callers wrap this in try/catch and
 * surface `{ ok: false }`).
 */
export async function requireAdmin() {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Unauthorized");
  }
  return user;
}
