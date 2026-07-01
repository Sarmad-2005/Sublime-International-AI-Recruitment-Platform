"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit2,
  Eye,
  MoreHorizontal,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { JOB_SECTOR_LABELS, ROUTES, type JobPostStatus } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cloneJobPostAction, updateJobStatusAction } from "@/app/(admin)/admin/jobs/actions";
import type { AdminJobListItem, PaginatedJobs } from "@/types";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<JobPostStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
  ACTIVE: { label: "Active", className: "bg-green-50 text-green-700 border-green-200" },
  CLOSED: { label: "Closed", className: "bg-orange-50 text-orange-700 border-orange-200" },
  FILLED: { label: "Filled", className: "bg-blue-50 text-blue-700 border-blue-200" },
};

function StatusBadge({ status }: { status: JobPostStatus }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.DRAFT;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

function JobRowActions({ job }: { job: AdminJobListItem }) {
  const router = useRouter();

  async function handleToggleStatus() {
    const newStatus: JobPostStatus =
      job.status === "ACTIVE" ? "CLOSED" : "ACTIVE";
    const result = await updateJobStatusAction(job.id, newStatus);
    if (result.ok) {
      toast.success(`Job marked as ${newStatus.toLowerCase()}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleClone() {
    const result = await cloneJobPostAction(job.id);
    if (result.ok) {
      toast.success("Job cloned as draft");
      router.push(`${ROUTES.ADMIN}/jobs/${result.data.id}/edit`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button asChild variant="ghost" size="icon" className="size-8" title="View">
        <Link href={`${ROUTES.ADMIN}/jobs/${job.id}`}>
          <Eye className="size-4" />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" className="size-8" title="Edit">
        <Link href={`${ROUTES.ADMIN}/jobs/${job.id}/edit`}>
          <Edit2 className="size-4" />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" title="More actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleToggleStatus}>
            {job.status === "ACTIVE" ? (
              <>
                <ToggleLeft className="size-4" />
                Close Job
              </>
            ) : (
              <>
                <ToggleRight className="size-4" />
                Activate Job
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleClone}>
            <Copy className="size-4" />
            Clone Job
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

interface JobsTableProps {
  data: PaginatedJobs;
  page: number;
}

export function JobsTable({ data, page }: JobsTableProps) {
  const router = useRouter();

  function changePage(next: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(next));
    router.push(`${ROUTES.ADMIN}/jobs?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-left">
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Sector</th>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 text-center font-semibold">Vacancies</th>
              <th className="px-4 py-3 text-center font-semibold">Applications</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Deadline</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-muted-foreground px-4 py-12 text-center text-sm"
                >
                  No job posts found. Create one to get started.
                </td>
              </tr>
            ) : (
              data.items.map((job) => <JobRow key={job.id} job={job} />)
            )}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-muted-foreground text-sm">
            {((page - 1) * data.pageSize + 1).toLocaleString()}–
            {Math.min(page * data.pageSize, data.total).toLocaleString()} of{" "}
            {data.total.toLocaleString()} jobs
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

function JobRow({ job }: { job: AdminJobListItem }) {
  const sectorLabel =
    JOB_SECTOR_LABELS[job.sector as keyof typeof JOB_SECTOR_LABELS] ?? job.sector;

  const deadlineDate = job.deadline ? new Date(job.deadline) : null;
  const isExpired = deadlineDate ? deadlineDate < new Date() : false;

  return (
    <tr className="group transition-colors hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          href={`${ROUTES.ADMIN}/jobs/${job.id}`}
          className="hover:text-royal line-clamp-1 max-w-[220px] font-medium transition-colors"
        >
          {job.title}
        </Link>
      </td>
      <td className="text-muted-foreground px-4 py-3 text-xs">
        {sectorLabel}
      </td>
      <td className="text-muted-foreground px-4 py-3 text-xs">
        {job.companyName}
      </td>
      <td className="px-4 py-3 text-center tabular-nums">{job.vacancies}</td>
      <td className="px-4 py-3 text-center">
        <Link
          href={`${ROUTES.ADMIN}/candidates?jobPostId=${job.id}`}
          className="text-royal hover:underline tabular-nums"
        >
          {job.applicationsCount}
        </Link>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={job.status} />
      </td>
      <td className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
        {deadlineDate ? (
          <span className={cn(isExpired && "text-red-500")}>
            {format(deadlineDate, "d MMM yyyy")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <JobRowActions job={job} />
      </td>
    </tr>
  );
}
