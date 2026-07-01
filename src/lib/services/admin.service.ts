import "server-only";

import {
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
} from "date-fns";

import { prisma, Prisma } from "@/lib/prisma";
import type { ApplicationStatus, CandidateTier as PrismaCandidateTier } from "@/generated/prisma/enums";
import {
  CANDIDATE_TIER_LABELS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_ORDER,
  type CandidateTier,
} from "@/lib/constants";
import { formatAuditLogActivity } from "@/lib/utils/activity";
import type {
  ActivityItem,
  AdminApplicationSummary,
  AdminCandidateDetailView,
  AdminCandidateFilters,
  AdminCandidateListItem,
  AdminCandidateNote,
  AdminTierRecord,
  DashboardMetric,
  DashboardMetrics,
  JobPostSummary,
  PaginatedCandidates,
  PipelineCounts,
  SaudiClientSummary,
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

// ---------------------------------------------------------------------------
// Candidate management
// ---------------------------------------------------------------------------

/** Paginated list of candidates with filter/search support. */
export async function getCandidates(
  filters: AdminCandidateFilters,
  pagination: { page: number; pageSize: number },
): Promise<PaginatedCandidates> {
  const { page, pageSize } = pagination;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ApplicationWhereInput = {};

  if (filters.statuses.length > 0) {
    where.status = { in: filters.statuses as ApplicationStatus[] };
  }
  if (filters.tiers.length > 0) {
    where.tierRecord = {
      tier: { in: filters.tiers as PrismaCandidateTier[] },
    };
  }
  if (filters.assessmentPassed !== null) {
    where.assessmentAttempt = { passed: filters.assessmentPassed };
  }
  if (filters.dateFrom || filters.dateTo) {
    where.appliedAt = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }
  if (filters.jobPostId) {
    where.jobPostId = filters.jobPostId;
  }
  if (filters.q) {
    const q = filters.q.trim();
    where.candidate = {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { cnic: { contains: q } },
        { user: { phone: { contains: q } } },
      ],
    };
  }

  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            profilePhotoUrl: true,
            user: { select: { phone: true } },
          },
        },
        jobPost: {
          select: {
            id: true,
            title: true,
            saudiClient: { select: { companyName: true } },
          },
        },
        tierRecord: {
          select: { tier: true, finalScore: true },
        },
        assessmentAttempt: {
          select: { score: true, passed: true, flaggedSuspicious: true },
        },
        aiInterviewAttempt: {
          select: { overallInterviewScore: true },
        },
      },
      orderBy: { appliedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  const items: AdminCandidateListItem[] = rows.map((app) => ({
    applicationId: app.id,
    candidateId: app.candidate.id,
    fullName: app.candidate.fullName,
    profilePhotoUrl: app.candidate.profilePhotoUrl,
    jobTitle: app.jobPost.title,
    jobPostId: app.jobPost.id,
    companyName: app.jobPost.saudiClient.companyName,
    appliedAt: app.appliedAt.toISOString(),
    status: app.status,
    tier: (app.tierRecord?.tier ?? "PENDING") as CandidateTier,
    assessmentScore: app.assessmentAttempt?.score ?? null,
    assessmentPassed: app.assessmentAttempt?.passed ?? null,
    interviewScore: app.aiInterviewAttempt?.overallInterviewScore ?? null,
    finalScore: app.tierRecord?.finalScore ?? null,
    flaggedSuspicious: app.assessmentAttempt?.flaggedSuspicious ?? false,
  }));

  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

/** Full candidate view for the detail page (all applications + notes). */
export async function getCandidateDetail(
  candidateId: string,
): Promise<AdminCandidateDetailView | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      user: { select: { email: true, phone: true } },
      applications: {
        orderBy: { appliedAt: "desc" },
        include: {
          jobPost: {
            select: {
              id: true,
              title: true,
              saudiClient: { select: { companyName: true } },
            },
          },
          assessmentAttempt: {
            select: {
              score: true,
              passed: true,
              flaggedSuspicious: true,
              tabSwitchCount: true,
              submittedAt: true,
            },
          },
          aiInterviewAttempt: {
            select: {
              status: true,
              overallInterviewScore: true,
              technicalScore: true,
              communicationScore: true,
              behavioralScore: true,
              confidenceScore: true,
              aiSummary: true,
              recordingUrl: true,
              completedAt: true,
            },
          },
          tierRecord: {
            select: {
              tier: true,
              finalScore: true,
              assessmentScore: true,
              interviewScore: true,
              assessmentWeight: true,
              interviewWeight: true,
              adminOverride: true,
              adminOverrideNote: true,
              assignedAt: true,
            },
          },
          postSelectionRecord: {
            select: {
              offerLetterStatus: true,
              gamcaStatus: true,
              visaStatus: true,
              ticketArrangement: true,
              preDepartureBriefStatus: true,
              arrivalStatus: true,
              probationStatus: true,
            },
          },
        },
      },
    },
  });

  if (!profile) return null;

  const notes = await prisma.auditLog.findMany({
    where: { action: "ADMIN_NOTE", entityType: "CANDIDATE", entityId: candidateId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const applications: AdminApplicationSummary[] = profile.applications.map((app) => ({
    id: app.id,
    jobPostId: app.jobPost.id,
    jobTitle: app.jobPost.title,
    companyName: app.jobPost.saudiClient.companyName,
    status: app.status,
    appliedAt: app.appliedAt.toISOString(),
    tier: (app.tierRecord?.tier ?? "PENDING") as CandidateTier,
    finalScore: app.tierRecord?.finalScore ?? null,
    assessment: app.assessmentAttempt
      ? {
          score: app.assessmentAttempt.score,
          passed: app.assessmentAttempt.passed,
          flaggedSuspicious: app.assessmentAttempt.flaggedSuspicious,
          tabSwitchCount: app.assessmentAttempt.tabSwitchCount,
          submittedAt: app.assessmentAttempt.submittedAt?.toISOString() ?? null,
        }
      : null,
    interview: app.aiInterviewAttempt
      ? {
          status: app.aiInterviewAttempt.status,
          overallScore: app.aiInterviewAttempt.overallInterviewScore,
          technicalScore: app.aiInterviewAttempt.technicalScore,
          communicationScore: app.aiInterviewAttempt.communicationScore,
          behavioralScore: app.aiInterviewAttempt.behavioralScore,
          confidenceScore: app.aiInterviewAttempt.confidenceScore,
          aiSummary: app.aiInterviewAttempt.aiSummary,
          recordingUrl: app.aiInterviewAttempt.recordingUrl,
          completedAt: app.aiInterviewAttempt.completedAt?.toISOString() ?? null,
        }
      : null,
    tierRecord: app.tierRecord
      ? {
          tier: app.tierRecord.tier as CandidateTier,
          finalScore: app.tierRecord.finalScore,
          assessmentScore: app.tierRecord.assessmentScore,
          interviewScore: app.tierRecord.interviewScore,
          assessmentWeight: Number(app.tierRecord.assessmentWeight),
          interviewWeight: Number(app.tierRecord.interviewWeight),
          adminOverride: app.tierRecord.adminOverride,
          adminOverrideNote: app.tierRecord.adminOverrideNote,
          assignedAt: app.tierRecord.assignedAt?.toISOString() ?? null,
        }
      : null,
    postSelection: app.postSelectionRecord
      ? {
          offerLetterStatus: app.postSelectionRecord.offerLetterStatus,
          gamcaStatus: app.postSelectionRecord.gamcaStatus,
          visaStatus: app.postSelectionRecord.visaStatus,
          ticketArrangement: app.postSelectionRecord.ticketArrangement,
          preDepartureBriefStatus: app.postSelectionRecord.preDepartureBriefStatus,
          arrivalStatus: app.postSelectionRecord.arrivalStatus,
          probationStatus: app.postSelectionRecord.probationStatus,
        }
      : null,
  }));

  return {
    candidate: {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      fatherName: profile.fatherName,
      cnic: profile.cnic,
      dateOfBirth: profile.dateOfBirth.toISOString().split("T")[0],
      gender: profile.gender,
      nationality: profile.nationality,
      maritalStatus: profile.maritalStatus,
      religion: profile.religion,
      passportNumber: profile.passportNumber,
      passportIssueDate: profile.passportIssueDate?.toISOString().split("T")[0] ?? null,
      passportExpiryDate: profile.passportExpiryDate?.toISOString().split("T")[0] ?? null,
      passportIssuePlace: profile.passportIssuePlace,
      permanentAddress: profile.permanentAddress,
      currentAddress: profile.currentAddress,
      city: profile.city,
      province: profile.province,
      country: profile.country,
      postalCode: profile.postalCode,
      educationLevel: profile.educationLevel,
      primaryTrade: profile.primaryTrade,
      secondaryTrade: profile.secondaryTrade,
      yearsOfExperience: profile.yearsOfExperience,
      profilePhotoUrl: profile.profilePhotoUrl,
      cvUrl: profile.cvUrl,
      cvUploadedAt: profile.cvUploadedAt?.toISOString() ?? null,
      passportCopyUrl: profile.passportCopyUrl,
      emergencyContactName: profile.emergencyContactName,
      emergencyContactRelation: profile.emergencyContactRelation,
      emergencyContactPhone: profile.emergencyContactPhone,
      emergencyContactAddress: profile.emergencyContactAddress,
    },
    userEmail: profile.user.email,
    userPhone: profile.user.phone,
    applications,
    notes: notes.map((n) => ({
      id: n.id,
      note: (n.newValue as { note?: string } | null)?.note ?? "",
      adminId: n.userId,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

/** Override a candidate's tier for a specific application with a mandatory reason. */
export async function overrideTier(
  applicationId: string,
  newTier: CandidateTier,
  reason: string,
  adminId: string,
): Promise<AdminTierRecord> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { candidateId: true },
  });

  const now = new Date();
  const record = await prisma.candidateTierRecord.upsert({
    where: { applicationId },
    create: {
      applicationId,
      candidateId: app.candidateId,
      tier: newTier as PrismaCandidateTier,
      adminOverride: true,
      adminOverrideNote: reason,
      assignedById: adminId,
      assignedAt: now,
    },
    update: {
      tier: newTier as PrismaCandidateTier,
      adminOverride: true,
      adminOverrideNote: reason,
      assignedById: adminId,
      assignedAt: now,
    },
  });

  await Promise.all([
    prisma.application.update({
      where: { id: applicationId },
      data: { status: "TIERED" },
    }),
    prisma.auditLog.create({
      data: {
        userId: adminId,
        action: "TIER_OVERRIDE",
        entityType: "APPLICATION",
        entityId: applicationId,
        newValue: { tier: newTier, reason },
      },
    }),
  ]);

  return {
    tier: record.tier as CandidateTier,
    finalScore: record.finalScore,
    assessmentScore: record.assessmentScore,
    interviewScore: record.interviewScore,
    assessmentWeight: Number(record.assessmentWeight),
    interviewWeight: Number(record.interviewWeight),
    adminOverride: record.adminOverride,
    adminOverrideNote: record.adminOverrideNote,
    assignedAt: record.assignedAt?.toISOString() ?? null,
  };
}

/** Move a candidate's application to a new pipeline status. */
export async function moveCandidateStage(
  applicationId: string,
  newStatus: ApplicationStatus,
  adminId: string,
): Promise<{ status: ApplicationStatus }> {
  const prev = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { status: true },
  });

  await Promise.all([
    prisma.application.update({
      where: { id: applicationId },
      data: { status: newStatus },
    }),
    prisma.auditLog.create({
      data: {
        userId: adminId,
        action: "STAGE_MOVED",
        entityType: "APPLICATION",
        entityId: applicationId,
        oldValue: { status: prev?.status },
        newValue: { status: newStatus },
      },
    }),
  ]);

  return { status: newStatus };
}

/** Add a candidate's application to a Saudi client's pool. */
export async function addCandidateToPool(
  applicationId: string,
  saudiClientId: string,
  adminId: string,
): Promise<{ id: string }> {
  const pool = await prisma.saudiClientCandidatePool.upsert({
    where: { saudiClientId_applicationId: { saudiClientId, applicationId } },
    create: { saudiClientId, applicationId, clientStatus: "UNREVIEWED" },
    update: {},
  });

  await Promise.all([
    prisma.application.update({
      where: { id: applicationId },
      data: { status: "IN_CLIENT_POOL" },
    }),
    prisma.auditLog.create({
      data: {
        userId: adminId,
        action: "ADDED_TO_POOL",
        entityType: "APPLICATION",
        entityId: applicationId,
        newValue: { saudiClientId },
      },
    }),
  ]);

  return { id: pool.id };
}

/** Persist an admin-only internal note against a candidate. */
export async function addNote(
  candidateId: string,
  note: string,
  adminId: string,
): Promise<AdminCandidateNote> {
  const entry = await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: "ADMIN_NOTE",
      entityType: "CANDIDATE",
      entityId: candidateId,
      newValue: { note },
    },
  });

  return { id: entry.id, note, adminId, createdAt: entry.createdAt.toISOString() };
}

/** Generate a PDF-ready data payload for the given applications. */
export async function exportCandidatesPDF(applicationIds: string[]) {
  const rows = await prisma.application.findMany({
    where: { id: { in: applicationIds } },
    include: {
      candidate: {
        select: {
          fullName: true,
          primaryTrade: true,
          yearsOfExperience: true,
          profilePhotoUrl: true,
          city: true,
          educationLevel: true,
        },
      },
      jobPost: {
        select: { title: true, saudiClient: { select: { companyName: true } } },
      },
      tierRecord: { select: { tier: true, finalScore: true } },
      assessmentAttempt: { select: { score: true, passed: true } },
      aiInterviewAttempt: { select: { overallInterviewScore: true, aiSummary: true } },
    },
  });

  return rows.map((app) => ({
    applicationId: app.id,
    candidateName: app.candidate.fullName,
    trade: app.candidate.primaryTrade,
    yearsOfExperience: app.candidate.yearsOfExperience,
    city: app.candidate.city,
    educationLevel: app.candidate.educationLevel,
    profilePhotoUrl: app.candidate.profilePhotoUrl,
    jobTitle: app.jobPost.title,
    companyName: app.jobPost.saudiClient.companyName,
    tier: (app.tierRecord?.tier ?? "PENDING") as CandidateTier,
    finalScore: app.tierRecord?.finalScore ?? null,
    assessmentScore: app.assessmentAttempt?.score ?? null,
    assessmentPassed: app.assessmentAttempt?.passed ?? null,
    interviewScore: app.aiInterviewAttempt?.overallInterviewScore ?? null,
    aiSummary: app.aiInterviewAttempt?.aiSummary ?? null,
  }));
}

/** Lightweight job post list for filter dropdowns. */
export async function getJobPostsSummary(): Promise<JobPostSummary[]> {
  return prisma.jobPost.findMany({
    where: { status: { not: "DRAFT" } },
    select: { id: true, title: true },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });
}

/** Saudi client list for the Add to Pool modal. */
export async function getSaudiClients(): Promise<SaudiClientSummary[]> {
  return prisma.saudiClientProfile.findMany({
    select: { id: true, companyName: true, city: true, logoUrl: true },
    orderBy: { companyName: "asc" },
  });
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
