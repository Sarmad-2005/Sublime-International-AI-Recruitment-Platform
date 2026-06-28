import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { authService, jobService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { jobBoardQuerySchema } from "@/lib/validations";
import { jobBoardSearchParams } from "@/lib/utils/jobs";
import { JobBoard } from "@/components/candidate/JobBoard";

export const metadata: Metadata = {
  title: "Job Board — SIORP",
};

/**
 * Candidate Job Board (Server Component). Filters live entirely in the URL
 * (`searchParams`), so the first page is rendered server-side from those params
 * — shareable, bookmarkable and SEO-friendly. That SSR'd payload then seeds the
 * client `JobBoard`, where subsequent filter/search changes fetch via React
 * Query without a full reload.
 */
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    redirect(ROUTES.LOGIN);
  }

  const raw = await searchParams;
  // Flatten array params (?sector=a&sector=b) to the first value before parsing.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const parsed = jobBoardQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : jobBoardQuerySchema.parse({});

  const [t, initialData] = await Promise.all([
    getTranslations("candidate.jobs"),
    jobService.getJobBoard(query),
  ]);

  const initialQueryString = jobBoardSearchParams(jobService.toJobBoardQuery(query));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </header>

      <JobBoard initialData={initialData} initialQueryString={initialQueryString} />
    </div>
  );
}
