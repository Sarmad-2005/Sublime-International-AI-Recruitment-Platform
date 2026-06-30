import { NextResponse } from "next/server";

import { interviewService } from "@/lib/services";
import {
  InterviewError,
  statusForInterviewError,
} from "@/lib/services/interview.service";
import { interviewIdentitySchema } from "@/lib/validations";
import type { ApiResponse, InterviewIdentityResult } from "@/types";

/**
 * Store the candidate's CNIC identity snapshot (device-check step).
 *
 *   POST /api/interview/[token]/identity
 *     body: { imageDataUrl: "data:image/png;base64,..." }
 *     → { identityPhotoUrl }  (short-lived signed preview URL)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<ApiResponse<InterviewIdentityResult>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = interviewIdentitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid image.",
        },
      },
      { status: 422 },
    );
  }

  const { token } = await params;

  try {
    const identityPhotoUrl = await interviewService.captureIdentityPhoto(
      token,
      parsed.data.imageDataUrl,
    );
    return NextResponse.json({ success: true, data: { identityPhotoUrl } });
  } catch (error) {
    if (error instanceof InterviewError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: statusForInterviewError(error.code) },
      );
    }
    console.error("Failed to store identity snapshot", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Couldn't save the snapshot. Please try again." },
      },
      { status: 500 },
    );
  }
}
