import { NextResponse } from "next/server";

import { authService, candidateService, applicationService } from "@/lib/services";
import { ApplicationError } from "@/lib/services/application.service";
import { USER_ROLES } from "@/lib/constants";
import { createApplicationSchema } from "@/lib/validations";
import type { ApiResponse, ApplicationListItem } from "@/types";

/**
 * Applications API — backs the candidate's "My Applications" list and the
 * `ApplyModal` submit.
 *
 *   GET  /api/applications  → the signed-in candidate's applications (newest first)
 *   POST /api/applications  → create an application (profile must be ≥80% complete)
 *
 * Auth is resolved from the session cookie (middleware doesn't run on `/api/*`),
 * so each handler re-checks the caller is the signed-in candidate.
 */

/** Minimum profile completion required to apply (SRS M3 gate). */
const MIN_PROFILE_COMPLETION = 80;

function unauthorized(): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
    { status: 401 },
  );
}

export async function GET(): Promise<
  NextResponse<ApiResponse<ApplicationListItem[]>>
> {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) return unauthorized();

  const profile = await candidateService.getCandidateProfile(user.id);
  if (!profile) {
    return NextResponse.json({ success: true, data: [] });
  }

  const applications = await applicationService.getApplicationsByCandidate(profile.id);
  return NextResponse.json({ success: true, data: applications });
}

/** Map an `ApplicationError` code to an HTTP status. */
function statusForCode(code: ApplicationError["code"]): number {
  switch (code) {
    case "ALREADY_APPLIED":
      return 409;
    case "JOB_CLOSED":
      return 410;
    case "JOB_NOT_FOUND":
    case "NOT_FOUND":
      return 404;
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<ApplicationListItem>>> {
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

  const parsed = createApplicationSchema.safeParse(body);
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

  // Profile-completion gate — must be ≥80% before applying.
  const profile = await candidateService.getCandidateProfile(user.id);
  const completion = candidateService.getProfileCompletionPercentage(profile);
  if (!profile || completion < MIN_PROFILE_COMPLETION) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PROFILE_INCOMPLETE",
          message: `Complete your profile to at least ${MIN_PROFILE_COMPLETION}% before applying.`,
          details: { completion },
        },
      },
      { status: 409 },
    );
  }

  try {
    const application = await applicationService.createApplication(
      profile.id,
      parsed.data.jobPostId,
      parsed.data.cvUrl,
    );
    return NextResponse.json({ success: true, data: application }, { status: 201 });
  } catch (error) {
    if (error instanceof ApplicationError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: statusForCode(error.code) },
      );
    }
    console.error("Failed to create application", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      },
      { status: 500 },
    );
  }
}
