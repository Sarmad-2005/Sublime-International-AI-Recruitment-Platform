import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { authService, candidateService, assessmentService } from "@/lib/services";
import { AssessmentError } from "@/lib/services/assessment.service";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { AssessmentRunner } from "@/components/candidate/assessment";

export const metadata: Metadata = {
  title: "Assessment in progress — SIORP",
};

/**
 * The live assessment interface. A controlled, full-screen page: it loads the
 * in-progress attempt's questions server-side, then hands off to the client
 * `AssessmentRunner`. With no active attempt (never started, or already
 * submitted) it redirects back to the entry screen, so the page can't be
 * re-entered via the back button after submitting.
 */
export default async function AssessmentTakePage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    redirect(ROUTES.LOGIN);
  }

  const { applicationId } = await params;
  const entryHref = `/assessment/${applicationId}`;

  const profile = await candidateService.getCandidateProfile(user.id);
  if (!profile) notFound();

  let take;
  try {
    take = await assessmentService.getAssessmentForApplication(applicationId, profile.id);
  } catch (error) {
    // No active attempt (not started, or already submitted) → back to entry.
    if (error instanceof AssessmentError) redirect(entryHref);
    throw error;
  }

  if (!take) notFound();
  if (take.questions.length === 0) redirect(entryHref);

  return <AssessmentRunner applicationId={applicationId} take={take} />;
}
