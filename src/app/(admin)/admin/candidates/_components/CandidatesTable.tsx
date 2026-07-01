"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MoveRight,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUS_LABELS,
  CANDIDATE_TIER_LABELS,
  ROUTES,
} from "@/lib/constants";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PDFExportButton } from "@/components/admin/candidate/PDFExport";
import { moveCandidateStageAction } from "@/app/(admin)/admin/candidates/actions";
import type { AdminCandidateListItem, PaginatedCandidates } from "@/types";

// ---------------------------------------------------------------------------
// Tier badge styling
// ---------------------------------------------------------------------------

const TIER_BADGE_CLASS: Record<string, string> = {
  DIAMOND: "bg-cyan-50 text-cyan-700 border-cyan-200",
  PLATINUM: "bg-slate-100 text-slate-600 border-slate-200",
  GOLD: "bg-amber-50 text-amber-700 border-amber-200",
  BRONZE: "bg-orange-50 text-orange-700 border-orange-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
  PENDING: "bg-muted text-muted-foreground border-border",
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const colors: Record<string, string> = {
    APPLIED: "bg-slate-100 text-slate-600",
    ASSESSMENT_PENDING: "bg-blue-50 text-blue-700",
    ASSESSMENT_PASSED: "bg-blue-100 text-blue-800",
    ASSESSMENT_FAILED: "bg-red-50 text-red-600",
    INTERVIEW_INVITED: "bg-indigo-50 text-indigo-700",
    INTERVIEW_IN_PROGRESS: "bg-indigo-100 text-indigo-800",
    INTERVIEW_COMPLETED: "bg-indigo-200 text-indigo-900",
    TIERED: "bg-teal-50 text-teal-700",
    IN_CLIENT_POOL: "bg-teal-100 text-teal-800",
    CLIENT_SHORTLISTED: "bg-teal-200 text-teal-900",
    LIVE_INTERVIEW_SCHEDULED: "bg-purple-50 text-purple-700",
    SELECTED: "bg-green-50 text-green-700",
    POST_SELECTION: "bg-emerald-100 text-emerald-800",
    DEPLOYED: "bg-emerald-200 text-emerald-900",
    REJECTED: "bg-red-100 text-red-700",
    WITHDRAWN: "bg-slate-200 text-slate-600",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {APPLICATION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Move Stage quick dropdown
// ---------------------------------------------------------------------------

const QUICK_STAGES: { label: string; value: ApplicationStatus }[] = [
  { label: "Assessment Pending", value: "ASSESSMENT_PENDING" },
  { label: "Interview Invited", value: "INTERVIEW_INVITED" },
  { label: "Tiered", value: "TIERED" },
  { label: "In Client Pool", value: "IN_CLIENT_POOL" },
  { label: "Selected", value: "SELECTED" },
  { label: "Rejected", value: "REJECTED" },
];

function MoveStageMenu({ applicationId }: { applicationId: string }) {
  const t = useTranslations("admin.candidates.table");
  const router = useRouter();

  async function move(status: ApplicationStatus) {
    const result = await moveCandidateStageAction(applicationId, status);
    if (result.ok) {
      toast.success(t("movedTo", { stage: APPLICATION_STATUS_LABELS[status] }));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" title={t("moveStage")}>
          <MoveRight className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("moveToStage")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {QUICK_STAGES.map((s) => (
          <DropdownMenuItem key={s.value} onSelect={() => move(s.value)}>
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Score cell
// ---------------------------------------------------------------------------

function ScoreCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className="tabular-nums text-sm">{score.toFixed(1)}</span>;
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

interface CandidatesTableProps {
  data: PaginatedCandidates;
  page: number;
  basePath: string;
}

export function CandidatesTable({ data, page, basePath }: CandidatesTableProps) {
  const t = useTranslations("admin.candidates.table");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleRow(applicationId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) next.delete(applicationId);
      else next.add(applicationId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === data.items.length) return new Set();
      return new Set(data.items.map((r) => r.applicationId));
    });
  }

  function changePage(next: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(next));
    router.push(`${basePath}?${params.toString()}`);
  }

  const allChecked =
    data.items.length > 0 && selected.size === data.items.length;
  const someChecked = selected.size > 0 && selected.size < data.items.length;

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="bg-royal/5 border-royal/20 flex items-center gap-3 rounded-md border px-4 py-2">
          <span className="text-royal text-sm font-medium">
            {t("selectedCount", { count: selected.size })}
          </span>
          <PDFExportButton applicationIds={[...selected]} />
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSelected(new Set())}
          >
            {t("clear")}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-left">
              <th className="px-3 py-3">
                <Checkbox
                  checked={allChecked}
                  data-indeterminate={someChecked || undefined}
                  onCheckedChange={toggleAll}
                  aria-label={t("selectAll")}
                />
              </th>
              <th className="px-3 py-3 font-semibold">{t("candidate")}</th>
              <th className="px-3 py-3 font-semibold">{t("jobAppliedFor")}</th>
              <th className="px-3 py-3 font-semibold">{t("applied")}</th>
              <th className="px-3 py-3 font-semibold">{t("stage")}</th>
              <th className="px-3 py-3 font-semibold">{t("tier")}</th>
              <th className="px-3 py-3 text-center font-semibold">{t("assessmentShort")}</th>
              <th className="px-3 py-3 text-center font-semibold">{t("interview")}</th>
              <th className="px-3 py-3 text-center font-semibold">{t("final")}</th>
              <th className="px-3 py-3 text-right font-semibold">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="text-muted-foreground px-4 py-12 text-center text-sm"
                >
                  {t("empty")}
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <CandidateRow
                  key={row.applicationId}
                  row={row}
                  selected={selected.has(row.applicationId)}
                  onToggle={() => toggleRow(row.applicationId)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-muted-foreground text-sm">
            {t("rangeSummary", {
              from: ((page - 1) * data.pageSize + 1).toLocaleString(),
              to: Math.min(page * data.pageSize, data.total).toLocaleString(),
              total: data.total.toLocaleString(),
            })}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-muted-foreground flex items-center px-2 text-sm">
              {page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= data.totalPages}
              onClick={() => changePage(page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function CandidateRow({
  row,
  selected,
  onToggle,
}: {
  row: AdminCandidateListItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("admin.candidates.table");
  const initials = row.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <tr
      className={cn(
        "group transition-colors hover:bg-muted/30",
        selected && "bg-royal/5",
      )}
    >
      <td className="px-3 py-2.5">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={t("selectRow", { name: row.fullName })}
        />
      </td>

      {/* Candidate */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8 shrink-0">
            {row.profilePhotoUrl && (
              <AvatarImage src={row.profilePhotoUrl} alt={row.fullName} />
            )}
            <AvatarFallback className="bg-royal/10 text-royal text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="max-w-[140px] truncate font-medium">{row.fullName}</p>
            <p className="text-muted-foreground max-w-[140px] truncate text-xs">
              {row.companyName}
            </p>
          </div>
          {row.flaggedSuspicious && (
            <span title={t("suspicious")}>
              <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
            </span>
          )}
        </div>
      </td>

      {/* Job */}
      <td className="px-3 py-2.5">
        <span className="max-w-[160px] truncate block text-sm">{row.jobTitle}</span>
      </td>

      {/* Applied date */}
      <td className="px-3 py-2.5 text-sm tabular-nums whitespace-nowrap">
        {format(new Date(row.appliedAt), "d MMM yyyy")}
      </td>

      {/* Stage */}
      <td className="px-3 py-2.5">
        <StatusBadge status={row.status} />
      </td>

      {/* Tier */}
      <td className="px-3 py-2.5">
        <Badge
          variant="outline"
          className={cn("text-xs font-semibold", TIER_BADGE_CLASS[row.tier])}
        >
          {CANDIDATE_TIER_LABELS[row.tier]}
        </Badge>
      </td>

      {/* Assessment score */}
      <td className="px-3 py-2.5 text-center">
        {row.assessmentPassed === null ? (
          <span className="text-muted-foreground text-xs">{t("pending")}</span>
        ) : (
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              row.assessmentPassed ? "text-emerald-600" : "text-red-500",
            )}
          >
            {row.assessmentScore !== null ? `${row.assessmentScore.toFixed(0)}%` : "—"}
          </span>
        )}
      </td>

      {/* Interview score */}
      <td className="px-3 py-2.5 text-center">
        <ScoreCell score={row.interviewScore} />
      </td>

      {/* Final score */}
      <td className="px-3 py-2.5 text-center">
        <ScoreCell score={row.finalScore} />
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8"
            title={t("viewCandidate")}
          >
            <Link href={`${ROUTES.ADMIN}/candidates/${row.candidateId}?applicationId=${row.applicationId}`}>
              <Eye className="size-4" />
            </Link>
          </Button>
          <MoveStageMenu applicationId={row.applicationId} />
        </div>
      </td>
    </tr>
  );
}
