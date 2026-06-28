import { NextResponse } from "next/server";

import { authService, candidateService, applicationService } from "@/lib/services";
import { USER_ROLES } from "@/lib/constants";
import type { ApiResponse, ApplicationDetailDTO } from "@/types";

/**
 * Single application detail API.
 *
 *   GET /api/applications/[id] → full detail for one of the caller's applications
 *
 * Scoped to the signed-in candidate; another candidate's application id resolves
 * to 404 (the service filters by owner) rather than leaking its existence.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<ApplicationDetailDTO>>> {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
      { status: 401 },
    );
  }

  const profile = await candidateService.getCandidateProfile(user.id);
  if (!profile) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Application not found." } },
      { status: 404 },
    );
  }

  const { id } = await params;
  const detail = await applicationService.getApplicationDetail(id, profile.id);
  if (!detail) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Application not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: detail });
}
