import { NextResponse, after } from "next/server";

import { interviewService } from "@/lib/services";
import {
  InterviewError,
  statusForInterviewError,
} from "@/lib/services/interview.service";
import { scoreInterviewSchema } from "@/lib/validations";
import type { ApiResponse, InterviewScoreResult } from "@/types";

/**
 * Complete & score an AI interview (SRS M5 §3 — the AI Scoring Endpoint).
 *
 *   POST /api/interview/[token]/score
 *     body: { transcript: [...], recordingUrl?, durationSeconds? }
 *
 * Marks the attempt COMPLETED, scores the transcript with Gemini, runs the
 * weighted tier calculation, advances the application to TIERED, and notifies
 * the candidate (email + in-app) and admins (in-app). Idempotent — a re-submit
 * of an already-scored interview returns the existing result.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<ApiResponse<InterviewScoreResult>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = scoreInterviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid transcript.",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { token } = await params;

  try {
    const { result, afterResponse } = await interviewService.completeAndScore(token, {
      transcript: parsed.data.transcript,
      recordingUrl: parsed.data.recordingUrl ?? null,
      durationSeconds: parsed.data.durationSeconds ?? 0,
    });
    // Stitch the recording + send notifications after the response is flushed,
    // so the candidate sees their score without waiting on either.
    after(afterResponse);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof InterviewError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: statusForInterviewError(error.code) },
      );
    }
    console.error("Failed to score interview", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Scoring failed. Please try again." },
      },
      { status: 500 },
    );
  }
}
