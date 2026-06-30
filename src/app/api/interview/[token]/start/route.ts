import { NextResponse } from "next/server";

import { interviewService } from "@/lib/services";
import {
  InterviewError,
  statusForInterviewError,
} from "@/lib/services/interview.service";
import { startInterviewSchema } from "@/lib/validations";
import type { ApiResponse, InterviewSessionDTO } from "@/types";

/**
 * Begin (or resume) an AI interview. Token-scoped — no auth beyond the one-time
 * invite token.
 *
 *   POST /api/interview/[token]/start
 *     body: { consent: true, deviceCheck: {...}, identityPhotoUrl?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<ApiResponse<InterviewSessionDTO>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = startInterviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            parsed.error.issues[0]?.message ?? "Consent and a device check are required.",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { token } = await params;

  try {
    const session = await interviewService.startInterview(token, {
      consent: parsed.data.consent,
      deviceCheck: parsed.data.deviceCheck,
      identityPhotoUrl: parsed.data.identityPhotoUrl ?? null,
    });
    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    if (error instanceof InterviewError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: statusForInterviewError(error.code) },
      );
    }
    console.error("Failed to start interview", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      },
      { status: 500 },
    );
  }
}
