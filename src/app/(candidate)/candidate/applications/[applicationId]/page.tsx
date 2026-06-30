import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import {
  ArrowLeft,
  Award,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  MapPin,
} from "lucide-react";

import {
  authService,
  candidateService,
  applicationService,
  interviewService,
} from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import {
  applicationAction,
  ACTION_LABEL_KEY,
} from "@/lib/utils/applications";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ApplicationStatusBadge,
  TierBadge,
} from "@/components/candidate/ApplicationBadges";
import { ApplicationTimeline } from "@/components/candidate/ApplicationTimeline";

export const metadata: Metadata = {
  title: "Application — SIORP",
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    redirect(ROUTES.LOGIN);
  }

  const { applicationId } = await params;
  const [t, tApps, profile] = await Promise.all([
    getTranslations("candidate.applicationDetail"),
    getTranslations("candidate.applications"),
    candidateService.getCandidateProfile(user.id),
  ]);

  const app = profile
    ? await applicationService.getApplicationDetail(applicationId, profile.id)
    : null;

  if (!app) notFound();

  const action = applicationAction(app.status);

  // Route the next-action button. The Stage-1 assessment flow lives at
  // /assessment/[id]; assessment outcomes deep-link to its result screen. The
  // Stage-2 AI interview is token-based at /interview/<token> — resolve the
  // owner-scoped invite token so "Start AI Interview" actually navigates there.
  const assessmentHref = `/assessment/${app.id}`;

  let interviewHref: string | null = null;
  if (action === "interview" && profile) {
    const invite = await interviewService.getInviteTokenForApplication(
      app.id,
      profile.id,
    );
    if (invite && invite.state !== "COMPLETED" && invite.state !== "EXPIRED") {
      interviewHref = `/interview/${invite.token}`;
    }
  }

  const actionHref =
    action === "assessment"
      ? assessmentHref
      : action === "interview" && interviewHref
        ? interviewHref
        : action === "results" &&
            (app.status === "ASSESSMENT_PASSED" || app.status === "ASSESSMENT_FAILED")
          ? `${assessmentHref}/result`
          : `${ROUTES.CANDIDATE}/applications/${app.id}`;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link href={`${ROUTES.CANDIDATE}/applications`}>
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
      </Button>

      {/* Header + next action */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Link
              href={`${ROUTES.CANDIDATE}/jobs/${app.jobPostId}`}
              className="hover:text-royal text-xl font-bold transition-colors"
            >
              {app.jobTitle}
            </Link>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <Building2 className="size-4" />
                {app.companyName}
              </span>
              {app.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {[app.city, app.country].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {t("appliedOn", {
                date: format(new Date(app.appliedAt), "d MMM yyyy"),
              })}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {t("currentStatus")}
              </span>
              <ApplicationStatusBadge status={app.status} />
              {app.tier && <TierBadge tier={app.tier} />}
            </div>
            <Button asChild variant="brand" size="sm">
              <Link href={actionHref}>{tApps(ACTION_LABEL_KEY[action])}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicationTimeline items={app.timeline} />
            </CardContent>
          </Card>

          {/* Post-selection tracker */}
          {app.postSelection && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("deploymentHeading")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-sm">
                    {t("deploymentProgress", {
                      percent: app.postSelection.progress,
                    })}
                  </p>
                  <Progress
                    value={app.postSelection.progress}
                    indicatorClassName="bg-royal"
                  />
                </div>
                <ul className="space-y-2">
                  {app.postSelection.milestones.map((m) => (
                    <li key={m.stage} className="flex items-center gap-2 text-sm">
                      {m.done ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="text-muted-foreground/40 size-4 shrink-0" />
                      )}
                      <span className={m.done ? "" : "text-muted-foreground"}>
                        {m.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results sidebar */}
        <div className="space-y-4">
          {app.assessment && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("assessmentHeading")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {app.assessment.submittedAt ? (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground text-sm">
                        {t("assessmentScore")}
                      </span>
                      <span className="text-2xl font-bold tabular-nums">
                        {Math.round(app.assessment.score ?? 0)}%
                      </span>
                    </div>
                    <Badge
                      variant={app.assessment.passed ? "success" : "destructive"}
                    >
                      {app.assessment.passed
                        ? t("assessmentPassed")
                        : t("assessmentFailed")}
                    </Badge>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t("assessmentPending")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {app.interview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("interviewHeading")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {app.interview.tier && (
                  <div className="flex items-center gap-2">
                    <Award className="text-royal size-4" />
                    <TierBadge tier={app.interview.tier} />
                  </div>
                )}
                {app.interview.overallScore != null && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground text-sm">
                      {t("interviewScore")}
                    </span>
                    <span className="text-xl font-bold tabular-nums">
                      {Math.round(app.interview.overallScore)}%
                    </span>
                  </div>
                )}
                {app.interview.aiSummary && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {t("interviewSummary")}
                    </p>
                    <p className="text-sm leading-relaxed">
                      {app.interview.aiSummary}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {app.cvUrl && (
            <Card>
              <CardContent className={cn("flex items-center justify-between gap-3")}>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="text-royal size-4" />
                  {t("cv")}
                </span>
                <Button asChild variant="outline" size="sm">
                  <a href={app.cvUrl} target="_blank" rel="noopener noreferrer">
                    {t("viewCv")}
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
