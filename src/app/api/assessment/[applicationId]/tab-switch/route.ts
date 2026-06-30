import { NextResponse } from "next/server";

import { authService, candidateService, assessmentService } from "@/lib/services";
import { AssessmentError } from "@/lib/services/assessment.service";
import { USER_ROLES } from "@/lib/constants";
import type { ApiResponse, TabSwitchResult } from "@/types";

/**
 * Log a tab/visibility switch during an attempt (anti-cheating, SRS M4).
 *
 *   POST /api/assessment/[applicationId]/tab-switch → { count, autoSubmit }
 *
 * `autoSubmit` is true once the candidate hits `ASSESSMENT_TAB_SWITCH_LIMIT`,
 * at which point the client force-submits with `flaggedSuspicious=true`.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse<ApiResponse<TabSwitchResult>>> {
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

  const { applicationId } = await params;

  try {
    const result = await assessmentService.logTabSwitch(applicationId, profile.id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AssessmentError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    console.error("Failed to log tab switch", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      },
      { status: 500 },
    );
  }
}
