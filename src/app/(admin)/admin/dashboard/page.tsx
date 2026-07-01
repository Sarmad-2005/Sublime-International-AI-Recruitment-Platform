import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Briefcase, PlaneTakeoff, UserCheck, Users } from "lucide-react";

import { adminService, authService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import {
  ActivityFeed,
  MetricCard,
  PipelineFunnel,
  TierDistributionChart,
  TopJobPostsTable,
} from "@/components/admin";

export const metadata: Metadata = {
  title: "Dashboard — SIORP Admin",
};

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

/**
 * Admin dashboard (Server Component). Every metric is fetched on the server in
 * parallel; the charts and activity feed are client components hydrated with
 * this server-fetched data.
 */
export default async function AdminDashboardPage() {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    redirect(ROUTES.LOGIN);
  }

  const [metrics, pipeline, tiers, activity, topJobs, t] = await Promise.all([
    adminService.getDashboardMetrics(),
    adminService.getPipelineCounts(),
    adminService.getTierDistribution(),
    adminService.getRecentActivity(10),
    adminService.getTopJobPosts(5),
    getTranslations("admin.dashboard"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t("metrics.activeJobPosts")}
          value={metrics.activeJobPosts.value}
          change={metrics.activeJobPosts.change}
          icon={Briefcase}
          color="royal"
        />
        <MetricCard
          title={t("metrics.candidatesInPipeline")}
          value={metrics.candidatesInPipeline.value}
          change={metrics.candidatesInPipeline.change}
          icon={Users}
          color="navy"
        />
        <MetricCard
          title={t("metrics.shortlistedThisMonth")}
          value={metrics.shortlistedThisMonth.value}
          change={metrics.shortlistedThisMonth.change}
          icon={UserCheck}
          color="gold"
        />
        <MetricCard
          title={t("metrics.placementsThisYear")}
          value={metrics.placementsThisYear.value}
          change={metrics.placementsThisYear.change}
          icon={PlaneTakeoff}
          color="emerald"
        />
      </div>

      {/* Pipeline funnel + tier distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PipelineFunnel data={pipeline} />
        </div>
        <div className="lg:col-span-1">
          <TierDistributionChart data={tiers} />
        </div>
      </div>

      {/* Activity feed + top job posts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ActivityFeed initialItems={activity} />
        </div>
        <div className="lg:col-span-2">
          <TopJobPostsTable jobs={topJobs} />
        </div>
      </div>
    </div>
  );
}
