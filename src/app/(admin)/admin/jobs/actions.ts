"use server";

import { revalidatePath } from "next/cache";

import { authService, jobPostService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import type { JobPostStatus } from "@/lib/constants";
import type { AdminJobFormData } from "@/types";

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

async function requireAdmin() {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Unauthorized");
  }
  return user;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createJobPostAction(
  data: AdminJobFormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const result = await jobPostService.createJobPost(data, user.id);
    revalidatePath(`${ROUTES.ADMIN}/jobs`);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateJobPostAction(
  id: string,
  data: AdminJobFormData,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await jobPostService.updateJobPost(id, data, user.id);
    revalidatePath(`${ROUTES.ADMIN}/jobs`);
    revalidatePath(`${ROUTES.ADMIN}/jobs/${id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function cloneJobPostAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const result = await jobPostService.cloneJobPost(id, user.id);
    revalidatePath(`${ROUTES.ADMIN}/jobs`);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateJobStatusAction(
  id: string,
  status: JobPostStatus,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await jobPostService.updateJobStatus(id, status, user.id);
    revalidatePath(`${ROUTES.ADMIN}/jobs`);
    revalidatePath(`${ROUTES.ADMIN}/jobs/${id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
