import { NextResponse } from "next/server";

import { authService, candidateService, assessmentService } from "@/lib/services";
import { AssessmentError } from "@/lib/services/assessment.service";
import { USER_ROLES } from "@/lib/constants";
import { submitAssessmentSchema } from "@/lib/validations";
import type { ApiResponse, AssessmentResultDTO } from "@/types";

/**
 * Submit & score an assessment attempt.
 *
 *   POST /api/assessment/[applicationId]/submit
 *     body: { answers: Record<questionId, optionId[]>, flaggedSuspicious?: boolean }
 *
 * Scores server-side, persists the result, advances the pipeline and — on a
 * pass — provisions the AI interview (token + invite email). Idempotency: the
 * active-attempt lookup is owner-scoped and a submitted attempt 409s.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
): Promise<NextResponse<ApiResponse<AssessmentResultDTO>>> {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = submitAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Please check your input.",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { applicationId } = await params;

  // Resolve the owner-scoped active attempt, then score it.
  const attemptId = await assessmentService.getActiveAttemptId(applicationId, profile.id);
  if (!attemptId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "NO_ACTIVE_ATTEMPT", message: "No active attempt to submit." },
      },
      { status: 409 },
    );
  }

  try {
    const result = await assessmentService.scoreAttempt(
      attemptId,
      parsed.data.answers,
      parsed.data.flaggedSuspicious,
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AssessmentError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.code === "ALREADY_SUBMITTED" ? 409 : 400 },
      );
    }
    console.error("Failed to submit assessment", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      },
      { status: 500 },
    );
  }
}
