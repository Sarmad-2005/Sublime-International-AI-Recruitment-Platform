import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { interviewService } from "@/lib/services";
import { InterviewSession } from "@/components/candidate/interview";

export const metadata: Metadata = {
  title: "AI Interview in progress — SIORP",
  robots: { index: false, follow: false },
};

/**
 * The live AI interview (SRS M5). Only reachable once the interview has started
 * (status IN_PROGRESS) — otherwise we bounce back to the entry / device-check
 * screen so the candidate grants media access and accepts consent first.
 */
export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await interviewService.getInterviewSession(token);

  if (!session) {
    redirect(`/interview/${token}`);
  }

  return <InterviewSession session={session} />;
}
