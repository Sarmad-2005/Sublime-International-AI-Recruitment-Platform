"use server";

import { revalidatePath } from "next/cache";

import { authService, candidateService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";

/**
 * Server Actions for the candidate portal. Auth is re-checked server-side; the
 * UI guards are convenience only.
 */

/** Mark all of the signed-in candidate's notifications as read. */
export async function markNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    return { ok: false };
  }

  await candidateService.markAllNotificationsRead(user.id);
  // Refresh the layout so the bell badge clears on the next render.
  revalidatePath(ROUTES.CANDIDATE, "layout");
  return { ok: true };
}
