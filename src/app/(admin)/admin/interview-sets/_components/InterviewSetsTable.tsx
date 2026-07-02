"use client";

import Link from "next/link";
import { format } from "date-fns";
import { MessagesSquare } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import type { InterviewSetListItem } from "@/types";

const SETS = `${ROUTES.ADMIN}/interview-sets`;

export function InterviewSetsTable({ sets }: { sets: InterviewSetListItem[] }) {
  if (sets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <MessagesSquare className="text-muted-foreground size-8" />
        <div>
          <p className="font-medium">No interview sets yet</p>
          <p className="text-muted-foreground text-sm">
            Create an interview set to define the AI interview for a job.
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
            <th className="px-4 py-3 text-center font-semibold">Max Duration</th>
            <th className="px-4 py-3 font-semibold">Last Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sets.map((set) => (
            <tr key={set.id} className="group hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`${SETS}/${set.id}`}
                  className="hover:text-royal line-clamp-1 max-w-[240px] font-medium transition-colors"
                >
                  {set.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`${ROUTES.ADMIN}/jobs/${set.jobPostId}`}
                  className="text-royal line-clamp-1 max-w-[220px] text-xs hover:underline"
                >
                  {set.jobTitle}
                </Link>
                <p className="text-muted-foreground text-xs">{set.companyName}</p>
              </td>
              <td className="px-4 py-3 text-center tabular-nums">
                {set.questionCount}
              </td>
              <td className="px-4 py-3 text-center tabular-nums">
                {set.maxDurationMinutes} min
              </td>
              <td className="text-muted-foreground px-4 py-3 text-sm tabular-nums whitespace-nowrap">
                {format(new Date(set.updatedAt), "d MMM yyyy")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
