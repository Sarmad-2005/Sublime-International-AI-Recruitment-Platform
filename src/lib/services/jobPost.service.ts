import "server-only";

import { prisma, type Prisma } from "@/lib/prisma";
import {
  JOBS_PAGE_SIZE,
  JOB_POST_STATUSES,
  APPLICATION_STATUS_LABELS,
  type JobPostStatus,
} from "@/lib/constants";
import type {
  AdminJobListItem,
  AdminJobFilters,
  AdminJobFormData,
  AdminJobDetailDTO,
  JobMetrics,
  LinkedAssessmentInfo,
  LinkedInterviewSetInfo,
  Paginated,
  TierThresholds,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

/** Halalas (minor) → whole SAR major units. */
function toMajor(v: number | null): number | null {
  return v === null ? null : Math.round(v / 100);
}

/** Whole SAR major units → halalas. */
function toMinor(v: number | null | undefined): number | null {
  return v == null ? null : Math.round(v * 100);
}

/** Deserialise the benefits JSON string stored in the `benefits` column. */
function parseBenefits(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    // Legacy free-text format — return as-is wrapped in array
    return raw ? [raw] : [];
  }
}

/** Serialise the benefits array to a JSON string for storage. */
function serialiseBenefits(benefits: string[]): string | null {
  return benefits.length > 0 ? JSON.stringify(benefits) : null;
}

/** Serialise our typed TierThresholds object to a Prisma-compatible JsonValue. */
function toJsonValue(t: TierThresholds | null | undefined): Prisma.InputJsonValue | undefined {
  if (t == null) return undefined;
  return t as unknown as Prisma.InputJsonValue;
}

function parseTierThresholds(raw: Prisma.JsonValue | null): TierThresholds | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const t = raw as Record<string, unknown>;
  if (
    typeof t.diamondMin !== "number" ||
    typeof t.platinumMin !== "number" ||
    typeof t.goldMin !== "number" ||
    typeof t.bronzeMin !== "number"
  ) {
    return null;
  }
  return {
    diamondMin: t.diamondMin,
    platinumMin: t.platinumMin,
    goldMin: t.goldMin,
    bronzeMin: t.bronzeMin,
  };
}

// ---------------------------------------------------------------------------
// Selects
// ---------------------------------------------------------------------------

const listSelect = {
  id: true,
  title: true,
  sector: true,
  saudiClientId: true,
  vacancies: true,
  status: true,
  deadline: true,
  createdAt: true,
  saudiClient: { select: { companyName: true } },
  _count: { select: { applications: true } },
} satisfies Prisma.JobPostSelect;

type ListRow = Prisma.JobPostGetPayload<{ select: typeof listSelect }>;

function toListItem(j: ListRow): AdminJobListItem {
  return {
    id: j.id,
    title: j.title,
    sector: j.sector,
    clientId: j.saudiClientId,
    companyName: j.saudiClient.companyName,
    vacancies: j.vacancies,
    applicationsCount: j._count.applications,
    status: j.status as JobPostStatus,
    deadline: toIso(j.deadline),
    createdAt: toIso(j.createdAt)!,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Paginated + filtered job posts list for the admin jobs table. */
export async function getJobPosts(
  filters: AdminJobFilters,
  pagination: { page: number; pageSize?: number },
): Promise<Paginated<AdminJobListItem>> {
  const pageSize = pagination.pageSize ?? JOBS_PAGE_SIZE;
  const page = Math.max(1, pagination.page);

  const where: Prisma.JobPostWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.sector) where.sector = filters.sector;
  if (filters.clientId) where.saudiClientId = filters.clientId;

  const [total, rows] = await Promise.all([
    prisma.jobPost.count({ where }),
    prisma.jobPost.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: listSelect,
    }),
  ]);

  return {
    items: rows.map(toListItem),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Full detail DTO for the admin read view. */
export async function getJobPostDetail(id: string): Promise<AdminJobDetailDTO | null> {
  const job = await prisma.jobPost.findUnique({
    where: { id },
    include: {
      saudiClient: { select: { companyName: true } },
      tradeAssessment: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          totalQuestions: true,
          timeLimitMinutes: true,
        },
      },
      aiInterviewSet: {
        select: {
          id: true,
          title: true,
          maxDurationMinutes: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });

  if (!job) return null;

  const assessment: LinkedAssessmentInfo | null = job.tradeAssessment
    ? {
        id: job.tradeAssessment.id,
        title: job.tradeAssessment.title,
        passingScore: job.tradeAssessment.passingScore,
        totalQuestions: job.tradeAssessment.totalQuestions,
        timeLimitMinutes: job.tradeAssessment.timeLimitMinutes,
      }
    : null;

  const interviewSet: LinkedInterviewSetInfo | null = job.aiInterviewSet
    ? {
        id: job.aiInterviewSet.id,
        title: job.aiInterviewSet.title,
        questionCount: job.aiInterviewSet._count.questions,
        maxDurationMinutes: job.aiInterviewSet.maxDurationMinutes,
      }
    : null;

  return {
    id: job.id,
    title: job.title,
    sector: job.sector,
    companyName: job.saudiClient.companyName,
    clientId: job.saudiClientId,
    country: job.country,
    city: job.city,
    vacancies: job.vacancies,
    description: job.description,
    requiredQualifications: job.requirements,
    contractDurationMonths: job.contractDurationMonths,
    applicationDeadline: toIso(job.deadline),
    salaryMin: toMajor(job.salaryMin),
    salaryMax: toMajor(job.salaryMax),
    salaryCurrency: job.salaryCurrency,
    benefits: parseBenefits(job.benefits),
    status: job.status as JobPostStatus,
    assessmentWeight: job.assessmentWeight,
    interviewWeight: job.interviewWeight,
    tierThresholds: parseTierThresholds(job.tierThresholds),
    assessment,
    interviewSet,
    createdAt: toIso(job.createdAt)!,
    publishedAt: toIso(job.publishedAt),
  };
}

/** Form data shape loaded into the edit form. */
export async function getJobPostFormData(id: string): Promise<AdminJobFormData | null> {
  const detail = await getJobPostDetail(id);
  if (!detail) return null;

  return {
    title: detail.title,
    sector: detail.sector,
    country: detail.country,
    city: detail.city ?? "",
    clientId: detail.clientId,
    vacancies: detail.vacancies,
    status: (detail.status === "ACTIVE" ? "ACTIVE" : "DRAFT") as "DRAFT" | "ACTIVE",
    description: detail.description ?? "",
    requiredQualifications: detail.requiredQualifications ?? "",
    contractDurationMonths: detail.contractDurationMonths,
    applicationDeadline: detail.applicationDeadline
      ? detail.applicationDeadline.slice(0, 10)
      : null,
    salaryMin: detail.salaryMin,
    salaryMax: detail.salaryMax,
    benefits: detail.benefits,
    assessmentWeight: detail.assessmentWeight,
    interviewWeight: detail.interviewWeight,
    tierThresholds: detail.tierThresholds,
  };
}

/** Application-stage funnel metrics for a job's detail page. */
export async function getJobPostMetrics(id: string): Promise<JobMetrics> {
  const [total, groups] = await Promise.all([
    prisma.application.count({ where: { jobPostId: id } }),
    prisma.application.groupBy({
      by: ["status"],
      where: { jobPostId: id },
      _count: { status: true },
    }),
  ]);

  const countOf = (statuses: string[]) =>
    groups
      .filter((g) => statuses.includes(g.status))
      .reduce((s, g) => s + g._count.status, 0);

  const byStage = groups.map((g) => ({
    status: g.status,
    label: APPLICATION_STATUS_LABELS[g.status] ?? g.status,
    count: g._count.status,
  }));

  return {
    totalApplications: total,
    passedAssessment: countOf([
      "ASSESSMENT_PASSED",
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
    ]),
    completedInterview: countOf([
      "INTERVIEW_COMPLETED",
      "TIERED",
      "IN_CLIENT_POOL",
      "CLIENT_SHORTLISTED",
      "LIVE_INTERVIEW_SCHEDULED",
      "SELECTED",
      "POST_SELECTION",
      "DEPLOYED",
    ]),
    shortlisted: countOf([
      "TIERED",
      "IN_CLIENT_POOL",
      "CLIENT_SHORTLISTED",
      "LIVE_INTERVIEW_SCHEDULED",
    ]),
    selected: countOf(["SELECTED", "POST_SELECTION", "DEPLOYED"]),
    byStage,
  };
}

/** Create a new job post. */
export async function createJobPost(
  data: AdminJobFormData,
  _adminId: string,
): Promise<{ id: string }> {
  const job = await prisma.jobPost.create({
    data: {
      title: data.title,
      sector: data.sector,
      country: data.country,
      city: data.city || null,
      saudiClientId: data.clientId,
      vacancies: data.vacancies,
      status: data.status,
      description: data.description || null,
      requirements: data.requiredQualifications || null,
      contractDurationMonths: data.contractDurationMonths,
      deadline: data.applicationDeadline ? new Date(data.applicationDeadline) : null,
      salaryMin: toMinor(data.salaryMin),
      salaryMax: toMinor(data.salaryMax),
      benefits: serialiseBenefits(data.benefits),
      assessmentWeight: data.assessmentWeight,
      interviewWeight: data.interviewWeight,
      tierThresholds: toJsonValue(data.tierThresholds),
      publishedAt: data.status === "ACTIVE" ? new Date() : null,
    },
    select: { id: true },
  });
  return job;
}

/** Update an existing job post. */
export async function updateJobPost(
  id: string,
  data: AdminJobFormData,
  _adminId: string,
): Promise<void> {
  const existing = await prisma.jobPost.findUnique({ where: { id }, select: { publishedAt: true, status: true } });
  const goingLive = data.status === "ACTIVE" && existing?.status !== "ACTIVE";

  await prisma.jobPost.update({
    where: { id },
    data: {
      title: data.title,
      sector: data.sector,
      country: data.country,
      city: data.city || null,
      saudiClientId: data.clientId,
      vacancies: data.vacancies,
      status: data.status,
      description: data.description || null,
      requirements: data.requiredQualifications || null,
      contractDurationMonths: data.contractDurationMonths,
      deadline: data.applicationDeadline ? new Date(data.applicationDeadline) : null,
      salaryMin: toMinor(data.salaryMin),
      salaryMax: toMinor(data.salaryMax),
      benefits: serialiseBenefits(data.benefits),
      assessmentWeight: data.assessmentWeight,
      interviewWeight: data.interviewWeight,
      tierThresholds: toJsonValue(data.tierThresholds),
      ...(goingLive && !existing?.publishedAt ? { publishedAt: new Date() } : {}),
    },
  });
}

/** Clone a job post (all fields, status → DRAFT, suffix title). */
export async function cloneJobPost(
  id: string,
  _adminId: string,
): Promise<{ id: string }> {
  const source = await prisma.jobPost.findUniqueOrThrow({
    where: { id },
  });

  const clone = await prisma.jobPost.create({
    data: {
      title: `${source.title} (Copy)`,
      sector: source.sector,
      country: source.country,
      city: source.city,
      saudiClientId: source.saudiClientId,
      vacancies: source.vacancies,
      status: JOB_POST_STATUSES.DRAFT,
      description: source.description,
      requirements: source.requirements,
      contractDurationMonths: source.contractDurationMonths,
      deadline: source.deadline,
      salaryMin: source.salaryMin,
      salaryMax: source.salaryMax,
      benefits: source.benefits,
      assessmentWeight: source.assessmentWeight,
      interviewWeight: source.interviewWeight,
      tierThresholds: (source.tierThresholds ?? undefined) as Prisma.InputJsonValue | undefined,
      publishedAt: null,
    },
    select: { id: true },
  });
  return clone;
}

/** Toggle a job's status (ACTIVE ↔ CLOSED, or explicitly set any status). */
export async function updateJobStatus(
  id: string,
  status: JobPostStatus,
  _adminId: string,
): Promise<void> {
  const existing = await prisma.jobPost.findUnique({ where: { id }, select: { publishedAt: true } });
  await prisma.jobPost.update({
    where: { id },
    data: {
      status,
      ...(status === "ACTIVE" && !existing?.publishedAt
        ? { publishedAt: new Date() }
        : {}),
    },
  });
}

/** Quick summary list of all Saudi clients (for the client dropdown in the form). */
export async function getClientList(): Promise<Array<{ id: string; companyName: string; city: string }>> {
  const clients = await prisma.saudiClientProfile.findMany({
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true, city: true },
  });
  return clients;
}
