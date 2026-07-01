"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { Search, X } from "lucide-react";

import {
  CANDIDATE_TIER_LABELS,
  CANDIDATE_TIERS,
  type CandidateTier,
} from "@/lib/constants";
import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminCandidateFilters, JobPostSummary } from "@/types";

const PIPELINE_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "ASSESSMENT_PENDING",
  "ASSESSMENT_PASSED",
  "ASSESSMENT_FAILED",
  "INTERVIEW_INVITED",
  "INTERVIEW_IN_PROGRESS",
  "INTERVIEW_COMPLETED",
  "TIERED",
  "IN_CLIENT_POOL",
  "CLIENT_SHORTLISTED",
  "LIVE_INTERVIEW_SCHEDULED",
  "SELECTED",
  "POST_SELECTION",
  "DEPLOYED",
  "REJECTED",
  "WITHDRAWN",
];

const TIER_OPTIONS = Object.keys(CANDIDATE_TIERS).filter(
  (t) => t !== "PENDING",
) as CandidateTier[];

interface CandidatesFiltersBarProps {
  filters: AdminCandidateFilters;
  jobPosts: JobPostSummary[];
}

export function CandidatesFiltersBar({ filters, jobPosts }: CandidatesFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);

  const push = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        params.delete(key);
        if (value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, v));
          } else {
            params.set(key, value);
          }
        }
      }
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router],
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    push({ q: searchRef.current?.value.trim() || null });
  }

  function toggleStatus(status: ApplicationStatus) {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    push({ statuses: next.length > 0 ? next : null });
  }

  function toggleTier(tier: CandidateTier) {
    const next = filters.tiers.includes(tier)
      ? filters.tiers.filter((t) => t !== tier)
      : [...filters.tiers, tier];
    push({ tiers: next.length > 0 ? next : null });
  }

  const hasFilters =
    filters.q ||
    filters.jobPostId ||
    filters.statuses.length > 0 ||
    filters.tiers.length > 0 ||
    filters.assessmentPassed !== null ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-1">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            ref={searchRef}
            defaultValue={filters.q ?? ""}
            placeholder="Name, CNIC, phone…"
            className="h-9 w-56 pl-8"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Search
        </Button>
      </form>

      {/* Job Post filter */}
      <Select
        value={filters.jobPostId ?? "__all__"}
        onValueChange={(v) => push({ jobPostId: v === "__all__" ? null : v })}
      >
        <SelectTrigger className="h-9 w-48">
          <SelectValue placeholder="All Job Posts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Job Posts</SelectItem>
          {jobPosts.map((j) => (
            <SelectItem key={j.id} value={j.id}>
              {j.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Pipeline Stage multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            Stage
            {filters.statuses.length > 0 && (
              <span className="bg-royal text-white ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {filters.statuses.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52 max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Pipeline Stage</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PIPELINE_STATUSES.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={filters.statuses.includes(s)}
                onCheckedChange={() => toggleStatus(s)}
              />
              <span className="text-sm">
                {APPLICATION_STATUS_LABELS[s] ?? s}
              </span>
            </label>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tier multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            Tier
            {filters.tiers.length > 0 && (
              <span className="bg-royal text-white ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {filters.tiers.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44">
          <DropdownMenuLabel>Candidate Tier</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TIER_OPTIONS.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={filters.tiers.includes(t)}
                onCheckedChange={() => toggleTier(t)}
              />
              <span className="text-sm">{CANDIDATE_TIER_LABELS[t]}</span>
            </label>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assessment passed filter */}
      <Select
        value={
          filters.assessmentPassed === true
            ? "true"
            : filters.assessmentPassed === false
              ? "false"
              : "__all__"
        }
        onValueChange={(v) =>
          push({
            assessmentPassed:
              v === "__all__" ? null : v === "true" ? "true" : "false",
          })
        }
      >
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder="Assessment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Any Assessment</SelectItem>
          <SelectItem value="true">Assessment Passed</SelectItem>
          <SelectItem value="false">Assessment Failed</SelectItem>
        </SelectContent>
      </Select>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(e) => push({ dateFrom: e.target.value || null })}
          className="h-9 w-36"
          aria-label="Applied from date"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(e) => push({ dateTo: e.target.value || null })}
          className="h-9 w-36"
          aria-label="Applied to date"
        />
      </div>

      {/* Clear all */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() =>
            push({
              q: null,
              jobPostId: null,
              statuses: null,
              tiers: null,
              assessmentPassed: null,
              dateFrom: null,
              dateTo: null,
            })
          }
        >
          <X className="size-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
