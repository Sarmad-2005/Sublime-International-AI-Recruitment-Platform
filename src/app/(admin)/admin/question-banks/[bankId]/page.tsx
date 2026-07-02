import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { authService, questionBankService } from "@/lib/services";
import { ROUTES, ADMIN_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { BankSettingsForm } from "../_components/BankSettingsForm";
import { QuestionListEditor } from "../_components/QuestionListEditor";

export const metadata: Metadata = { title: "Question Bank — SIORP Admin" };

export default async function QuestionBankEditorPage({
  params,
}: {
  params: Promise<{ bankId: string }>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const { bankId } = await params;
  const bank = await questionBankService.getBankDetail(bankId);
  if (!bank) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-0.5 size-8">
          <Link href={`${ROUTES.ADMIN}/question-banks`}>
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{bank.title}</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            Linked to{" "}
            <Link
              href={`${ROUTES.ADMIN}/jobs/${bank.jobPostId}`}
              className="text-royal inline-flex items-center gap-0.5 hover:underline"
            >
              {bank.jobTitle}
              <ExternalLink className="size-3" />
            </Link>
            <span className="text-muted-foreground">· {bank.companyName}</span>
          </p>
        </div>
      </div>

      <BankSettingsForm bank={bank} />

      <QuestionListEditor bankId={bank.id} initialQuestions={bank.questions} />
    </div>
  );
}
