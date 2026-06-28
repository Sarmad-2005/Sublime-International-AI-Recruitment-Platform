import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { Briefcase, Building2, CalendarDays, MapPin } from "lucide-react";

import {
  authService,
  candidateService,
  applicationService,
} from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import {
  applicationAction,
  ACTION_LABEL_KEY,
} from "@/lib/utils/applications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ApplicationStatusBadge,
  TierBadge,
} from "@/components/candidate/ApplicationBadges";

export const metadata: Metadata = {
  title: "My Applications — SIORP",
};

/**
 * "My Applications" (Server Component). Lists every application the candidate
 * has submitted with its current pipeline stage, tier (once assigned) and a
 * context-aware next-action button. Data is fetched server-side in one call.
 */
export default async function ApplicationsPage() {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    redirect(ROUTES.LOGIN);
  }

  const [t, profile] = await Promise.all([
    getTranslations("candidate.applications"),
    candidateService.getCandidateProfile(user.id),
  ]);

  const applications = profile
    ? await applicationService.getApplicationsByCandidate(profile.id)
    : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </header>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-full">
              <Briefcase className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">{t("empty")}</p>
              <p className="text-muted-foreground text-sm">{t("emptyHint")}</p>
            </div>
            <Button asChild variant="brand">
              <Link href={`${ROUTES.CANDIDATE}/jobs`}>{t("browseJobs")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const action = applicationAction(app.status);
            const href = `${ROUTES.CANDIDATE}/applications/${app.id}`;
            return (
              <Card key={app.id}>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={href}
                        className="hover:text-royal font-semibold transition-colors"
                      >
                        {app.jobTitle}
                      </Link>
                      <ApplicationStatusBadge status={app.status} />
                      {app.tier && <TierBadge tier={app.tier} />}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="size-3.5" />
                        {app.companyName}
                      </span>
                      {app.city && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5" />
                          {app.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {t("appliedOn", {
                          date: format(new Date(app.appliedAt), "d MMM yyyy"),
                        })}
                      </span>
                    </div>
                  </div>
                  <Button
                    asChild
                    variant={action === "track" ? "outline" : "brand"}
                    size="sm"
                    className="shrink-0"
                  >
                    <Link href={href}>{t(ACTION_LABEL_KEY[action])}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
