"use client";

import Link from "next/link";
import { format } from "date-fns";
import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import type { QuestionBankListItem } from "@/types";

const BANKS = `${ROUTES.ADMIN}/question-banks`;

export function QuestionBanksTable({ banks }: { banks: QuestionBankListItem[] }) {
  if (banks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <BookOpen className="text-muted-foreground size-8" />
        <div>
          <p className="font-medium">No question banks yet</p>
          <p className="text-muted-foreground text-sm">
            Create a question bank to build an assessment for a job.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b text-left">
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="px-4 py-3 font-semibold">Linked Job</th>
            <th className="px-4 py-3 text-center font-semibold">Questions</th>
            <th className="px-4 py-3 text-center font-semibold">Pass Threshold</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Last Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {banks.map((bank) => (
            <tr key={bank.id} className="group hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`${BANKS}/${bank.id}`}
                  className="hover:text-royal line-clamp-1 max-w-[240px] font-medium transition-colors"
                >
                  {bank.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`${ROUTES.ADMIN}/jobs/${bank.jobPostId}`}
                  className="text-royal line-clamp-1 max-w-[220px] text-xs hover:underline"
                >
                  {bank.jobTitle}
                </Link>
                <p className="text-muted-foreground text-xs">{bank.companyName}</p>
              </td>
              <td className="px-4 py-3 text-center tabular-nums">
                {bank.totalQuestions}
              </td>
              <td className="px-4 py-3 text-center font-medium text-amber-600 tabular-nums">
                {bank.passingScore}%
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-medium",
                    bank.isActive
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                  )}
                >
                  {bank.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="text-muted-foreground px-4 py-3 text-sm tabular-nums whitespace-nowrap">
                {format(new Date(bank.updatedAt), "d MMM yyyy")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
