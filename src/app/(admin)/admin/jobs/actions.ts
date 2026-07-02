"use server";

import { revalidatePath } from "next/cache";

import { jobPostService } from "@/lib/services";
import { ROUTES } from "@/lib/constants";
import type { JobPostStatus } from "@/lib/constants";
import { requireAdmin, type ActionResult } from "@/lib/auth/admin-guard";
import type { AdminJobFormData } from "@/types";

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
