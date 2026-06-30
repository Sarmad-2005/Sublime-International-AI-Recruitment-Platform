import { NextResponse } from "next/server";

import { authService, candidateService, assessmentService } from "@/lib/services";
import { AssessmentError } from "@/lib/services/assessment.service";
import { USER_ROLES } from "@/lib/constants";
import type { ApiResponse, AssessmentTakeDTO } from "@/types";

/**
 * Assessment questions API.
 *
 *   GET /api/assessment/[applicationId] → config + candidate-safe questions for
 *   the in-progress attempt (questions/answers randomised per the assessment).
 *
 * Correct answers are never included — scoring is server-side only. Requires an
 * active (started, unsubmitted) attempt; otherwise returns 409.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse<ApiResponse<AssessmentTakeDTO>>> {
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
      { success: false, error: { code: "NOT_FOUND", message: "Assessment not found." } },
      { status: 404 },
    );
  }

  const { applicationId } = await params;

  try {
    const payload = await assessmentService.getAssessmentForApplication(
      applicationId,
      profile.id,
    );
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Assessment not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    if (error instanceof AssessmentError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    console.error("Failed to load assessment", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      },
      { status: 500 },
    );
  }
}
