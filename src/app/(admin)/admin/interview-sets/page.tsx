import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { authService, questionBankService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { InterviewSetsTable } from "./_components/InterviewSetsTable";
import { CreateInterviewSetDialog } from "./_components/CreateInterviewSetDialog";

export const metadata: Metadata = { title: "AI Interview Sets — SIORP Admin" };

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

export default async function InterviewSetsPage() {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const [sets, linkableJobs] = await Promise.all([
    questionBankService.getInterviewSets(),
    questionBankService.getLinkableJobsForInterview(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Interview Sets</h1>
          <p className="text-muted-foreground text-sm">
            {sets.length.toLocaleString()} interview set{sets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateInterviewSetDialog linkableJobs={linkableJobs} />
      </div>

      <InterviewSetsTable sets={sets} />
    </div>
  );
}
