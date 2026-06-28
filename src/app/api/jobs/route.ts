import { NextResponse } from "next/server";

import { authService, jobService } from "@/lib/services";
import { USER_ROLES } from "@/lib/constants";
import { jobBoardQuerySchema } from "@/lib/validations";
import type { ApiResponse, JobBoardResult } from "@/types";

/**
 * Job Board API — backs `useJobs`.
 *
 *   GET /api/jobs?search=&sector=&country=&salaryMin=&postedWithinDays=&page=
 *     → a filtered, paginated page of active jobs (+ country facet)
 *
 * Same query schema as the Server Component page, so the SSR'd first page and
 * subsequent client-side filter/search hits return identical shapes.
 */
export async function GET(
  request: Request,
): Promise<NextResponse<ApiResponse<JobBoardResult>>> {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in." } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = jobBoardQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid filters.",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const result = await jobService.getJobBoard(parsed.data);
  return NextResponse.json({ success: true, data: result });
}
