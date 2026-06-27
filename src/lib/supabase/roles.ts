import type { User } from "@supabase/supabase-js";
import { isUserRole, type UserRole } from "@/lib/constants";

/**
 * Client-safe helpers for reading the SIORP role off a Supabase user. Shared by
 * the Edge middleware (no DB access) and browser hooks, so this module must stay
 * free of `server-only` / Prisma imports.
 */

/**
 * Resolve a SIORP role from a Supabase user.
 *
 * `app_metadata.role` is authoritative — it can only be set server-side with the
 * service-role key (see `auth.service.syncUserToDatabase`), so a user cannot
 * tamper with it. `user_metadata.role` (set at sign-up) is only a fallback for
 * accounts created before the app_metadata write lands. For anything
 * security-sensitive on the server, prefer the database role via
 * `getCurrentUser()`.
 */
export function extractUserRole(
  user: Pick<User, "app_metadata" | "user_metadata">,
): UserRole | null {
  const appRole: unknown = user.app_metadata?.role;
  if (isUserRole(appRole)) return appRole;

  const metaRole: unknown = user.user_metadata?.role;
  if (isUserRole(metaRole)) return metaRole;

  return null;
}
