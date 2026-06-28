import "server-only";

import { prisma, type Prisma, type JobPost } from "@/lib/prisma";
import { JOB_BOARD_PAGE_SIZE } from "@/lib/validations";
import type {
  JobBenefitFlags,
  JobBoardItem,
  JobBoardQuery,
  JobBoardResult,
  JobDetailDTO,
} from "@/types";
import type { JobBoardQueryInput } from "@/lib/validations";

/**
 * Job service — the only layer that reads job posts for the candidate portal
 * (Rule #5). Returns JSON-safe DTOs (dates as ISO strings, salaries in major
 * units) so the same shapes flow from Server Components, the `/api/jobs` route
 * and the React Query hooks unchanged.
 *
 * Candidates only ever see ACTIVE jobs; drafts, closed and filled posts are
 * excluded at the query level.
 */

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** Halalas (minor units) → whole major currency units. */
function toMajorUnits(value: number | null): number | null {
  return value === null ? null : Math.round(value / 100);
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Split free-text requirements into trimmed, non-empty bullet lines. */
function toLines(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|•|;/)
    .map((line) => line.replace(/^[\s\-*]+/, "").trim())
    .filter((line) => line.length > 0);
}

/** Detect the standard benefits (accommodation / medical / transport / food). */
function parseBenefitFlags(text: string | null): JobBenefitFlags {
  const haystack = (text ?? "").toLowerCase();
  const has = (...keywords: string[]) =>
    keywords.some((k) => haystack.includes(k));
  return {
    accommodation: has("accommodation", "housing", "lodging", "stay"),
    medical: has("medical", "health", "insurance"),
    transport: has("transport", "transportation", "commute", "pickup"),
    food: has("food", "meal", "catering"),
  };
}

// ---------------------------------------------------------------------------
// Job Board (paginated, filtered list)
// ---------------------------------------------------------------------------

const jobCardSelect = {
  id: true,
  title: true,
  sector: true,
  city: true,
  country: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  vacancies: true,
  deadline: true,
  publishedAt: true,
  saudiClient: { select: { companyName: true } },
} satisfies Prisma.JobPostSelect;

type JobCardRow = Prisma.JobPostGetPayload<{ select: typeof jobCardSelect }>;

function toBoardItem(j: JobCardRow): JobBoardItem {
  return {
    id: j.id,
    title: j.title,
    companyName: j.saudiClient.companyName,
    sector: j.sector,
    city: j.city,
    country: j.country,
    salaryMin: toMajorUnits(j.salaryMin),
    salaryMax: toMajorUnits(j.salaryMax),
    salaryCurrency: j.salaryCurrency,
    vacancies: j.vacancies,
    deadline: toIso(j.deadline),
    publishedAt: toIso(j.publishedAt),
  };
}

/** Build the Prisma `where` for the active, candidate-visible jobs matching the query. */
function buildBoardWhere(query: JobBoardQueryInput): Prisma.JobPostWhereInput {
  const where: Prisma.JobPostWhereInput = { status: "ACTIVE" };

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.sector) where.sector = query.sector;
  if (query.country) where.country = query.country;
  if (query.salaryMin !== undefined) {
    // Stored in halalas — compare against the major-unit floor.
    where.salaryMax = { gte: query.salaryMin * 100 };
  }
  if (query.postedWithinDays !== undefined) {
    const since = new Date();
    since.setDate(since.getDate() - query.postedWithinDays);
    where.publishedAt = { gte: since };
  }

  return where;
}

/**
 * A page of active jobs matching the filters, newest first, plus the distinct
 * destination countries (for the country filter facet).
 */
export async function getJobBoard(
  query: JobBoardQueryInput,
): Promise<JobBoardResult> {
  const where = buildBoardWhere(query);
  const pageSize = JOB_BOARD_PAGE_SIZE;
  const page = Math.max(1, query.page);

  const [total, rows, countryGroups] = await Promise.all([
    prisma.jobPost.count({ where }),
    prisma.jobPost.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: jobCardSelect,
    }),
    prisma.jobPost.groupBy({
      by: ["country"],
      where: { status: "ACTIVE" },
      orderBy: { country: "asc" },
    }),
  ]);

  return {
    items: rows.map(toBoardItem),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    countries: countryGroups.map((g) => g.country),
  };
}

/** Narrow a raw `JobBoardQueryInput` to the JSON-safe `JobBoardQuery` echo. */
export function toJobBoardQuery(query: JobBoardQueryInput): JobBoardQuery {
  return {
    search: query.search ?? null,
    sector: query.sector ?? null,
    country: query.country ?? null,
    salaryMin: query.salaryMin ?? null,
    postedWithinDays: query.postedWithinDays ?? null,
    page: query.page,
  };
}

// ---------------------------------------------------------------------------
// Job detail
// ---------------------------------------------------------------------------

function toDetailDTO(j: JobPost & { saudiClient: { companyName: string } }): JobDetailDTO {
  return {
    id: j.id,
    title: j.title,
    companyName: j.saudiClient.companyName,
    sector: j.sector,
    description: j.description,
    requirements: toLines(j.requirements),
    benefitsText: j.benefits,
    benefitFlags: parseBenefitFlags(j.benefits),
    city: j.city,
    country: j.country,
    vacancies: j.vacancies,
    salaryMin: toMajorUnits(j.salaryMin),
    salaryMax: toMajorUnits(j.salaryMax),
    salaryCurrency: j.salaryCurrency,
    contractDurationMonths: j.contractDurationMonths,
    deadline: toIso(j.deadline),
    publishedAt: toIso(j.publishedAt),
    status: j.status,
    isExpired: j.deadline ? j.deadline.getTime() < Date.now() : false,
  };
}

/** Full detail for a single active job, or `null` if missing/not visible. */
export async function getJobDetail(jobId: string): Promise<JobDetailDTO | null> {
  const job = await prisma.jobPost.findFirst({
    where: { id: jobId, status: "ACTIVE" },
    include: { saudiClient: { select: { companyName: true } } },
  });
  return job ? toDetailDTO(job) : null;
}
