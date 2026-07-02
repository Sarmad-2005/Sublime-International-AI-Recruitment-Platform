import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { authService, questionBankService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { InterviewSetSettingsForm } from "../_components/InterviewSetSettingsForm";
import { InterviewQuestionListEditor } from "../_components/InterviewQuestionListEditor";

export const metadata: Metadata = { title: "AI Interview Set — SIORP Admin" };

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

export default async function InterviewSetEditorPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const { setId } = await params;
  const set = await questionBankService.getInterviewSetDetail(setId);
  if (!set) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-0.5 size-8">
          <Link href={`${ROUTES.ADMIN}/interview-sets`}>
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{set.title}</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            Linked to{" "}
            <Link
              href={`${ROUTES.ADMIN}/jobs/${set.jobPostId}`}
              className="text-royal inline-flex items-center gap-0.5 hover:underline"
            >
              {set.jobTitle}
              <ExternalLink className="size-3" />
            </Link>
            <span className="text-muted-foreground">· {set.companyName}</span>
          </p>
        </div>
      </div>

      <InterviewSetSettingsForm set={set} />

      <InterviewQuestionListEditor set={set} />
    </div>
  );
}
