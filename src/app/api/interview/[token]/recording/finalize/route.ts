import { NextResponse } from "next/server";

import { interviewService } from "@/lib/services";
import {
  InterviewError,
  statusForInterviewError,
} from "@/lib/services/interview.service";
import type { ApiResponse, InterviewFinalizeResult } from "@/types";

/**
 * Finalize the recording — stitch the uploaded chunks into one WebM and persist
 * its storage path.
 *
 *   POST /api/interview/[token]/recording/finalize → { recordingUrl }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<ApiResponse<InterviewFinalizeResult>>> {
  const { token } = await params;

  try {
    const recordingUrl = await interviewService.finalizeRecording(token);
    return NextResponse.json({ success: true, data: { recordingUrl } });
  } catch (error) {
    if (error instanceof InterviewError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: statusForInterviewError(error.code) },
      );
    }
    console.error("Failed to finalize recording", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Couldn't finalize the recording." },
      },
      { status: 500 },
    );
  }
}
