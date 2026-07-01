"use server";

import { revalidatePath } from "next/cache";

import { authService, candidateService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";

/**
 * Server Actions for the admin portal. Auth/role is re-checked server-side; the
 * UI guards are convenience only.
 */

/** Roles permitted to use the admin portal. */
const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

/** Mark all of the signed-in admin's notifications as read. */
export async function markAdminNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return { ok: false };
  }

  await candidateService.markAllNotificationsRead(user.id);
  // Refresh the admin layout so the bell badge clears on the next render.
  revalidatePath(ROUTES.ADMIN, "layout");
  return { ok: true };
}
