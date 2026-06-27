import { NextResponse } from "next/server";
import { authService } from "@/lib/services";
import { USER_ROLES } from "@/lib/constants";
import type { MeResponse } from "@/types";

/**
 * `GET /api/auth/me` — the current candidate's profile summary (or `null`).
 *
 * Backs `useCurrentCandidate`. Auth is resolved from the session cookie inside
 * the service via the Supabase server client, so no body/params are needed.
 */
export async function GET(): Promise<NextResponse<MeResponse>> {
  const user = await authService.getCurrentUser();

  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    return NextResponse.json({ candidate: null });
  }

  const candidate = await authService.getCurrentCandidateProfile(user.id);
  return NextResponse.json({ candidate });
}
