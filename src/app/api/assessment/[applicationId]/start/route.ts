import { NextResponse } from "next/server";

import { authService, candidateService, assessmentService } from "@/lib/services";
import { AssessmentError } from "@/lib/services/assessment.service";
import { USER_ROLES } from "@/lib/constants";
import type { ApiResponse, StartAttemptResult } from "@/types";

/**
 * Start (or resume) an assessment attempt.
 *
 *   POST /api/assessment/[applicationId]/start → { attemptId, startedAt, endsAt }
 *
 * Creates the attempt on a first try, resumes an in-progress one, or resets a
 * failed attempt when a retake is allowed and unlocked.
 */

/** Map an `AssessmentError` code to an HTTP status. */
function statusForCode(code: AssessmentError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "NOT_CONFIGURED":
      return 404;
    case "NO_CV":
      return 409;
    case "ALREADY_PASSED":
    case "ALREADY_ADVANCED":
    case "RETAKE_LOCKED":
      return 409;
    default:
      return 409;
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse<ApiResponse<StartAttemptResult>>> {
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
    const result = await assessmentService.startAttempt(applicationId, profile.id);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof AssessmentError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: statusForCode(error.code) },
      );
    }
    console.error("Failed to start assessment attempt", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      },
      { status: 500 },
    );
  }
}
