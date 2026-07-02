import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { authService, questionBankService } from "@/lib/services";
import { ROUTES, ADMIN_ROLES } from "@/lib/constants";
import { QuestionBanksTable } from "./_components/QuestionBanksTable";
import { CreateBankDialog } from "./_components/CreateBankDialog";

export const metadata: Metadata = { title: "Question Banks — SIORP Admin" };

export default async function QuestionBanksPage() {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const [banks, linkableJobs] = await Promise.all([
    questionBankService.getBanks(),
    questionBankService.getLinkableJobsForAssessment(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Question Banks</h1>
          <p className="text-muted-foreground text-sm">
            {banks.length.toLocaleString()} assessment bank
            {banks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateBankDialog linkableJobs={linkableJobs} />
      </div>

      <QuestionBanksTable banks={banks} />
    </div>
  );
}
