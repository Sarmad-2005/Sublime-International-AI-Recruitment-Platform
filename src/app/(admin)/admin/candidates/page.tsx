import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { adminService, authService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import type { ApplicationStatus, CandidateTier } from "@/generated/prisma/enums";
import { CandidatesFiltersBar } from "./_components/CandidatesFiltersBar";
import { CandidatesTable } from "./_components/CandidatesTable";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.candidates.meta");
  return { title: t("listTitle") };
}

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];
const PAGE_SIZE = 25;

interface PageSearchParams {
  q?: string;
  jobPostId?: string;
  statuses?: string | string[];
  tiers?: string | string[];
  assessmentPassed?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const filters = {
    q: params.q?.trim() || null,
    jobPostId: params.jobPostId || null,
    statuses: toArray(params.statuses) as ApplicationStatus[],
    tiers: toArray(params.tiers) as CandidateTier[],
    assessmentPassed:
      params.assessmentPassed === "true"
        ? true
        : params.assessmentPassed === "false"
          ? false
          : null,
    dateFrom: params.dateFrom || null,
    dateTo: params.dateTo || null,
  };

  const [result, jobPosts, t] = await Promise.all([
    adminService.getCandidates(filters, { page, pageSize: PAGE_SIZE }),
    adminService.getJobPostsSummary(),
    getTranslations("admin.candidates.list"),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("heading")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("countFound", { count: result.total })}
          </p>
        </div>
      </div>

      <CandidatesFiltersBar filters={filters} jobPosts={jobPosts} />

      <CandidatesTable
        data={result}
        page={page}
        basePath={`${ROUTES.ADMIN}/candidates`}
      />
    </div>
  );
}
