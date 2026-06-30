import { NextResponse } from "next/server";

import { interviewService } from "@/lib/services";
import {
  InterviewError,
  statusForInterviewError,
} from "@/lib/services/interview.service";
import type { ApiResponse, InterviewChunkResult } from "@/types";

/** 24 MB ceiling per chunk (~30s of WebM video at typical bitrates). */
const MAX_CHUNK_BYTES = 24 * 1024 * 1024;

/**
 * Upload one streamed recording chunk. The body is the raw chunk bytes (not
 * JSON); the chunk's order is passed as `?chunkIndex=N`.
 *
 *   POST /api/interview/[token]/recording/chunk?chunkIndex=0
 *     body: <binary WebM bytes>
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<ApiResponse<InterviewChunkResult>>> {
  const url = new URL(request.url);
  const chunkIndex = Number(url.searchParams.get("chunkIndex"));
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Missing or invalid chunkIndex." } },
      { status: 400 },
    );
  }

  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Empty chunk." } },
      { status: 400 },
    );
  }
  if (arrayBuffer.byteLength > MAX_CHUNK_BYTES) {
    return NextResponse.json(
      { success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Chunk too large." } },
      { status: 413 },
    );
  }

  const { token } = await params;
  const contentType = request.headers.get("content-type") || "video/webm";

  try {
    await interviewService.uploadRecordingChunk(
      token,
      chunkIndex,
      Buffer.from(arrayBuffer),
      contentType,
    );
    return NextResponse.json({ success: true, data: { chunkIndex, received: true } });
  } catch (error) {
    if (error instanceof InterviewError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: statusForInterviewError(error.code) },
      );
    }
    console.error("Failed to upload recording chunk", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Couldn't save the chunk." },
      },
      { status: 500 },
    );
  }
}
