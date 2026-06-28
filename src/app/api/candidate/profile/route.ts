import { NextResponse } from "next/server";

import { authService, candidateService } from "@/lib/services";
import { CandidateProfileError } from "@/lib/services/candidate.service";
import { USER_ROLES } from "@/lib/constants";
import { updateCandidateProfileSchema } from "@/lib/validations";
import type { ApiResponse, CandidateProfileDTO, ProfileCompletion } from "@/types";

/**
 * Candidate profile API — backs `useCandidateProfile`.
 *
 *   GET   /api/candidate/profile  → current profile + completion
 *   PATCH /api/candidate/profile  → save one section (partial), returns the same
 *
 * Auth is resolved from the session cookie (the middleware doesn't run on
 * `/api/*`), so each handler re-checks the caller is the signed-in candidate.
 */

export interface CandidateProfilePayload {
  profile: CandidateProfileDTO | null;
  completion: ProfileCompletion;
}

function unauthorized(): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
    { status: 401 },
  );
}

export async function GET(): Promise<
  NextResponse<ApiResponse<CandidateProfilePayload>>
> {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) return unauthorized();

  const profile = await candidateService.getCandidateProfile(user.id);
  const completion = candidateService.computeProfileCompletion(profile);

  return NextResponse.json({ success: true, data: { profile, completion } });
}

export async function PATCH(
  request: Request,
): Promise<NextResponse<ApiResponse<CandidateProfilePayload>>> {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = updateCandidateProfileSchema.safeParse(body);
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

  try {
    const profile = await candidateService.updateCandidateProfile(
      user.id,
      parsed.data,
    );
    const completion = candidateService.computeProfileCompletion(profile);
    return NextResponse.json({ success: true, data: { profile, completion } });
  } catch (error) {
    if (error instanceof CandidateProfileError) {
      return NextResponse.json(
        { success: false, error: { code: "PROFILE_INCOMPLETE", message: error.message } },
        { status: 409 },
      );
    }
    console.error("Failed to update candidate profile", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      },
      { status: 500 },
    );
  }
}
