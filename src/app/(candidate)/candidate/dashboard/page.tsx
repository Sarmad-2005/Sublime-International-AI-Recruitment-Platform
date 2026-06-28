import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { authService, candidateService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DashboardStatusCards } from "@/components/candidate/DashboardStatusCards";
import { DashboardActivity } from "@/components/candidate/DashboardActivity";
import { FeaturedJobs } from "@/components/candidate/FeaturedJobs";
import { ProfileCompletionBanner } from "@/components/candidate/ProfileCompletionBanner";

export const metadata: Metadata = {
  title: "Dashboard — SIORP",
};

/**
 * Candidate dashboard (Server Component). All data is fetched on the server in a
 * single service call; the page is purely presentational below that.
 */
export default async function CandidateDashboardPage() {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    redirect(ROUTES.LOGIN);
  }

  const [data, t] = await Promise.all([
    candidateService.getCandidateDashboardData(user.id),
    getTranslations("candidate.dashboard"),
  ]);

  const displayName = data.fullName || user.email?.split("@")[0] || "";

  return (
    <div className="space-y-6">
      {/* Welcome banner with completion bar */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">
              {displayName
                ? t("welcome", { name: displayName })
                : t("welcomeFallback")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
          </div>
          <div className="w-full max-w-xs space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("profileCompletion")}
              </span>
              <span className="font-semibold tabular-nums">
                {data.completion.overall}%
              </span>
            </div>
            <Progress
              value={data.completion.overall}
              indicatorClassName="bg-royal"
            />
          </div>
        </CardContent>
      </Card>

      {/* Complete-your-profile CTA (hidden when 100%) */}
      <ProfileCompletionBanner completion={data.completion} />

      {/* Application status cards */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{t("statusHeading")}</h2>
          <span className="text-muted-foreground text-sm">
            {t("totalApplications", { count: data.totalApplications })}
          </span>
        </div>
        <DashboardStatusCards counts={data.statusCounts} />
      </section>

      {/* Activity + featured jobs */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <DashboardActivity items={data.recentActivity} />
        </div>
        <div className="lg:col-span-2">
          <FeaturedJobs jobs={data.featuredJobs} />
        </div>
      </div>
    </div>
  );
}
