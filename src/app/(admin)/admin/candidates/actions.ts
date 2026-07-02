"use server";

import { revalidatePath } from "next/cache";

import { adminService } from "@/lib/services";
import { ROUTES } from "@/lib/constants";
import type { CandidateTier } from "@/lib/constants";
import { requireAdmin, type ActionResult } from "@/lib/auth/admin-guard";
import type { ApplicationStatus } from "@/generated/prisma/enums";

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
    // @react-pdf/renderer types the root as ReactElement<DocumentProps>; derive
    // that from the function signature so there is no `any` and no drift.
    const element = React.createElement(CandidatePDFDocument, {
      candidates: data,
    }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(element);
    return { ok: true as const, base64: buffer.toString("base64") };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
