"use server";

import { revalidatePath } from "next/cache";

import { adminService, authService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import type { CandidateTier } from "@/lib/constants";
import type { ApplicationStatus } from "@/generated/prisma/enums";

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

export async function overrideTierAction(
  applicationId: string,
  newTier: CandidateTier,
  reason: string,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    if (reason.trim().length < 20) {
      return { ok: false, error: "Reason must be at least 20 characters." };
    }
    await adminService.overrideTier(applicationId, newTier, reason.trim(), user.id);
    revalidatePath(ROUTES.ADMIN, "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function moveCandidateStageAction(
  applicationId: string,
  newStatus: ApplicationStatus,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await adminService.moveCandidateStage(applicationId, newStatus, user.id);
    revalidatePath(ROUTES.ADMIN, "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function addCandidateToPoolAction(
  applicationId: string,
  saudiClientId: string,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await adminService.addCandidateToPool(applicationId, saudiClientId, user.id);
    revalidatePath(ROUTES.ADMIN, "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function addNoteAction(
  candidateId: string,
  note: string,
): Promise<ActionResult<{ id: string; note: string; adminId: string | null; createdAt: string }>> {
  try {
    const user = await requireAdmin();
    const result = await adminService.addNote(candidateId, note.trim(), user.id);
    revalidatePath(ROUTES.ADMIN, "layout");
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function exportCandidatesPDFAction(applicationIds: string[]) {
  try {
    await requireAdmin();
    const data = await adminService.exportCandidatesPDF(applicationIds);
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { CandidatePDFDocument } = await import(
      "@/components/admin/candidate/PDFExport"
    );
    const React = await import("react");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(CandidatePDFDocument, { candidates: data }) as any;
    const buffer = await renderToBuffer(element);
    return { ok: true as const, base64: buffer.toString("base64") };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
