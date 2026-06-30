import { NextResponse } from "next/server";

import { interviewService } from "@/lib/services";
import {
  InterviewError,
  statusForInterviewError,
} from "@/lib/services/interview.service";
import { interviewFollowUpSchema } from "@/lib/validations";
import type { ApiResponse, InterviewFollowUpResult } from "@/types";

/**
 * Generate a Gemini follow-up question from a Q/A pair, mid-interview. A failure
 * here is non-fatal — the route returns `{ followUp: null }` and the interview
 * continues to the next scripted question.
 *
 *   POST /api/interview/[token]/follow-up
 *     body: { questionId, question, response } → { followUp }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<ApiResponse<InterviewFollowUpResult>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = interviewFollowUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid request.",
        },
      },
      { status: 422 },
    );
  }

  const { token } = await params;

  try {
    const followUp = await interviewService.generateFollowUpForToken(
      token,
      parsed.data.questionId,
      parsed.data.question,
      parsed.data.response,
    );
    return NextResponse.json({ success: true, data: { followUp } });
  } catch (error) {
    if (error instanceof InterviewError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: statusForInterviewError(error.code) },
      );
    }
    console.error("Failed to generate follow-up", error);
    // Non-fatal: let the client move on without a follow-up.
    return NextResponse.json({ success: true, data: { followUp: null } });
  }
}
