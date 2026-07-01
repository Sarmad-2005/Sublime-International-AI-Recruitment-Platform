import "server-only";

import {
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
} from "date-fns";

import { prisma } from "@/lib/prisma";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import {
  CANDIDATE_TIER_LABELS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_ORDER,
  type CandidateTier,
} from "@/lib/constants";
import { formatAuditLogActivity } from "@/lib/utils/activity";
import type {
  ActivityItem,
  DashboardMetric,
  DashboardMetrics,
  PipelineCounts,
  TierDistribution,
  TopJobPost,
} from "@/types";

/**
 * Admin service — the only layer that reads aggregate platform data for the
 * staff dashboard (Rule #5). Every read returns JSON-safe DTOs (dates as ISO
 * strings) so the same shapes flow from the dashboard Server Component, the
 * realtime activity feed and any future `/api/admin/*` routes unchanged.
 */

// ---------------------------------------------------------------------------
// Pipeline mapping — detailed ApplicationStatus → funnel rank
// ---------------------------------------------------------------------------

/**
 * Rank of each application status within the 6-stage funnel
 * (`PIPELINE_STAGE_ORDER`). `null` = terminal/excluded (rejected, withdrawn) and
 * never counts toward the funnel or the active pipeline.
 */
const STATUS_RANK: Record<ApplicationStatus, number | null> = {
  APPLIED: 0,
  ASSESSMENT_PENDING: 1,
  ASSESSMENT_PASSED: 1,
  ASSESSMENT_FAILED: 1,
  INTERVIEW_INVITED: 2,
  INTERVIEW_IN_PROGRESS: 2,
  INTERVIEW_COMPLETED: 2,
  TIERED: 3,
  IN_CLIENT_POOL: 3,
  CLIENT_SHORTLISTED: 3,
  LIVE_INTERVIEW_SCHEDULED: 3,
  SELECTED: 4,
  POST_SELECTION: 5,
  DEPLOYED: 5,
  REJECTED: null,
  WITHDRAWN: null,
};

/** Statuses that represent a candidate having reached the "Shortlisted" stage. */
const SHORTLISTED_STATUSES: ApplicationStatus[] = [
  "TIERED",
  "IN_CLIENT_POOL",
  "CLIENT_SHORTLISTED",
  "LIVE_INTERVIEW_SCHEDULED",
];

/** Statuses excluded from the "in pipeline" headline (terminal outcomes). */
const TERMINAL_STATUSES: ApplicationStatus[] = [
  "REJECTED",
  "WITHDRAWN",
  "DEPLOYED",
];

/** Tiers shown in the distribution pie, in display order. */
const DISTRIBUTION_TIERS: CandidateTier[] = [
  "DIAMOND",
  "PLATINUM",
  "GOLD",
  "BRONZE",
  "PENDING",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Signed percent change from `previous` to `current`, rounded. Returns `null`
 * when the previous period was empty (a change ratio would be undefined).
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function metric(value: number, change: number | null): DashboardMetric {
  return { value, change };
}

// ---------------------------------------------------------------------------
// Headline metrics (4 cards)
// ---------------------------------------------------------------------------

/** The four headline metric cards, each with a period-over-period change. */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const yearStart = startOfYear(now);
  const prevYearStart = startOfYear(subYears(now, 1));

  const [
    activeJobPosts,
    jobsPublishedThisMonth,
    jobsPublishedLastMonth,
    candidatesInPipeline,
    appliedThisMonth,
    appliedLastMonth,
    shortlistedThisMonth,
    shortlistedLastMonth,
    placementsThisYear,
    placementsLastYear,
  ] = await Promise.all([
    prisma.jobPost.count({ where: { status: "ACTIVE" } }),
    prisma.jobPost.count({ where: { publishedAt: { gte: monthStart } } }),
    prisma.jobPost.count({
      where: { publishedAt: { gte: prevMonthStart, lt: monthStart } },
    }),
    prisma.application.count({
      where: { status: { notIn: TERMINAL_STATUSES } },
    }),
    prisma.application.count({ where: { appliedAt: { gte: monthStart } } }),
    prisma.application.count({
      where: { appliedAt: { gte: prevMonthStart, lt: monthStart } },
    }),
    prisma.application.count({
      where: {
        status: { in: SHORTLISTED_STATUSES },
        updatedAt: { gte: monthStart },
      },
    }),
    prisma.application.count({
      where: {
        status: { in: SHORTLISTED_STATUSES },
        updatedAt: { gte: prevMonthStart, lt: monthStart },
      },
    }),
    prisma.application.count({
      where: { status: "DEPLOYED", updatedAt: { gte: yearStart } },
    }),
    prisma.application.count({
      where: {
        status: "DEPLOYED",
        updatedAt: { gte: prevYearStart, lt: yearStart },
      },
    }),
  ]);

  return {
    activeJobPosts: metric(
      activeJobPosts,
      percentChange(jobsPublishedThisMonth, jobsPublishedLastMonth),
    ),
    candidatesInPipeline: metric(
      candidatesInPipeline,
      percentChange(appliedThisMonth, appliedLastMonth),
    ),
    shortlistedThisMonth: metric(
      shortlistedThisMonth,
      percentChange(shortlistedThisMonth, shortlistedLastMonth),
    ),
    placementsThisYear: metric(
      placementsThisYear,
      percentChange(placementsThisYear, placementsLastYear),
    ),
  };
}

// ---------------------------------------------------------------------------
// Pipeline funnel (cumulative — reached at-or-past each stage)
// ---------------------------------------------------------------------------

/**
 * Cumulative funnel counts. A candidate at the Interview stage also counts
 * toward Applied and Assessment, so the funnel is monotonically non-increasing
 * left-to-right.
 */
export async function getPipelineCounts(): Promise<PipelineCounts> {
  const grouped = await prisma.application.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  // Index by rank: reachedAtLeast[i] = applications whose rank >= i.
  const reachedAtLeast = PIPELINE_STAGE_ORDER.map(() => 0);
  for (const row of grouped) {
    const rank = STATUS_RANK[row.status];
    if (rank === null) continue;
    for (let i = 0; i <= rank; i++) {
      reachedAtLeast[i] += row._count._all;
    }
  }

  return PIPELINE_STAGE_ORDER.map((stage, i) => ({
    stage,
    label: PIPELINE_STAGE_LABELS[stage],
    count: reachedAtLeast[i],
  }));
}

// ---------------------------------------------------------------------------
// Tier distribution
// ---------------------------------------------------------------------------

/** Diamond / Platinum / Gold / Bronze / Pending breakdown across all tier records. */
export async function getTierDistribution(): Promise<TierDistribution> {
  const grouped = await prisma.candidateTierRecord.groupBy({
    by: ["tier"],
    _count: { _all: true },
  });

  const counts = new Map<CandidateTier, number>(
    grouped.map((g) => [g.tier, g._count._all]),
  );

  return DISTRIBUTION_TIERS.map((tier) => ({
    tier,
    label: CANDIDATE_TIER_LABELS[tier],
    count: counts.get(tier) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Recent activity (from the audit log)
// ---------------------------------------------------------------------------

/** The most recent audit-log events, formatted for the activity feed. */
export async function getRecentActivity(limit = 10): Promise<ActivityItem[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      newValue: true,
      createdAt: true,
    },
  });

  return rows.map((row) =>
    formatAuditLogActivity({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      newValue: row.newValue,
      createdAt: row.createdAt.toISOString(),
    }),
  );
}

// ---------------------------------------------------------------------------
// Top job posts
// ---------------------------------------------------------------------------

/** Job posts with the most applications, plus their shortlisted counts. */
export async function getTopJobPosts(limit = 5): Promise<TopJobPost[]> {
  const jobs = await prisma.jobPost.findMany({
    orderBy: { applications: { _count: "desc" } },
    take: limit,
    select: {
      id: true,
      title: true,
      deadline: true,
      status: true,
      saudiClient: { select: { companyName: true } },
      _count: { select: { applications: true } },
    },
  });

  if (jobs.length === 0) return [];

  // Shortlisted-or-beyond applications per job, in a single grouped query.
  const shortlistedByJob = await prisma.application.groupBy({
    by: ["jobPostId"],
    where: {
      jobPostId: { in: jobs.map((j) => j.id) },
      status: { in: SHORTLISTED_STATUSES },
    },
    _count: { _all: true },
  });
  const shortlistedMap = new Map(
    shortlistedByJob.map((g) => [g.jobPostId, g._count._all]),
  );

  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    companyName: j.saudiClient.companyName,
    applicants: j._count.applications,
    shortlisted: shortlistedMap.get(j.id) ?? 0,
    deadline: j.deadline ? j.deadline.toISOString() : null,
    status: j.status,
  }));
}
