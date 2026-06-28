import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  MapPin,
  Users,
} from "lucide-react";

import {
  authService,
  candidateService,
  jobService,
  applicationService,
} from "@/lib/services";
import {
  ROUTES,
  USER_ROLES,
  JOB_SECTOR_LABELS,
  type JobSector,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ApplyModal } from "@/components/candidate/ApplyModal";
import type { JobBenefitFlags, JobDetailDTO } from "@/types";

export const metadata: Metadata = {
  title: "Job Details — SIORP",
};

function sectorLabel(sector: string): string {
  return JOB_SECTOR_LABELS[sector as JobSector] ?? sector;
}

function salaryText(job: JobDetailDTO, negotiable: string): string {
  if (job.salaryMin !== null && job.salaryMax !== null) {
    return `${job.salaryCurrency} ${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}`;
  }
  return negotiable;
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    redirect(ROUTES.LOGIN);
  }

  const { jobId } = await params;
  const [t, tJobs, job] = await Promise.all([
    getTranslations("candidate.jobDetail"),
    getTranslations("candidate.jobs"),
    jobService.getJobDetail(jobId),
  ]);

  if (!job) notFound();

  const profile = await candidateService.getCandidateProfile(user.id);
  const completion = candidateService.getProfileCompletionPercentage(profile);
  const applicationId = profile
    ? await applicationService.getApplicationIdForJob(profile.id, job.id)
    : null;
  const hasApplied = applicationId !== null;

  const benefitItems: { key: keyof JobBenefitFlags; label: string }[] = [
    { key: "accommodation", label: t("benefitAccommodation") },
    { key: "medical", label: t("benefitMedical") },
    { key: "transport", label: t("benefitTransport") },
    { key: "food", label: t("benefitFood") },
  ];

  function ApplyAction({ full }: { full?: boolean }) {
    if (hasApplied) {
      return (
        <div className={full ? "flex flex-col gap-2" : "flex items-center gap-3"}>
          <Badge variant="success" className="gap-1 px-3 py-1.5 text-sm">
            <CheckCircle2 className="size-4" />
            {t("alreadyApplied")}
          </Badge>
          <Button asChild variant="outline" className={full ? "w-full" : ""}>
            <Link href={`${ROUTES.CANDIDATE}/applications/${applicationId}`}>
              {t("viewApplication")}
            </Link>
          </Button>
        </div>
      );
    }
    if (job!.isExpired) {
      return (
        <div className={full ? "space-y-1" : ""}>
          <Button disabled className={full ? "w-full" : ""}>
            {t("expired")}
          </Button>
          <p className="text-muted-foreground text-xs">{t("expiredHint")}</p>
        </div>
      );
    }
    return (
      <ApplyModal
        job={{ id: job!.id, title: job!.title }}
        profileComplete={completion}
        initialCvUrl={profile?.cvUrl ?? null}
        cvUploadedAt={profile?.cvUploadedAt ?? null}
        contact={{
          email: user!.email,
          emailVerified: user!.isEmailVerified,
          phone: user!.phone,
          phoneVerified: user!.isPhoneVerified,
        }}
        triggerLabel={t("applyNow")}
        triggerClassName={full ? "w-full" : ""}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link href={`${ROUTES.CANDIDATE}/jobs`}>
          <ArrowLeft className="size-4" />
          {t("backToJobs")}
        </Link>
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary">{sectorLabel(job.sector)}</Badge>
            <h1 className="text-2xl font-bold">{job.title}</h1>
            <p className="text-muted-foreground text-sm">{job.companyName}</p>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                {[job.city, job.country].filter(Boolean).join(", ")}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-4" />
                {tJobs("vacancies", { count: job.vacancies })}
              </span>
              {job.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  {tJobs("posted", {
                    date: format(new Date(job.publishedAt), "d MMM yyyy"),
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <ApplyAction />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("description")}</CardTitle>
            </CardHeader>
            <CardContent>
              {job.description ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {job.description}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">{t("noDescription")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("requirements")}</CardTitle>
            </CardHeader>
            <CardContent>
              {job.requirements.length > 0 ? (
                <ul className="space-y-2">
                  {job.requirements.map((req, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <CheckCircle2 className="text-royal mt-0.5 size-4 shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">{t("noRequirements")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("benefits")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {benefitItems.map((item) => {
                  const on = job.benefitFlags[item.key];
                  return (
                    <li
                      key={item.key}
                      className="flex items-center gap-2 text-sm"
                    >
                      {on ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="text-muted-foreground/40 size-4 shrink-0" />
                      )}
                      <span className={on ? "" : "text-muted-foreground"}>
                        {item.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {job.benefitsText && (
                <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap">
                  {job.benefitsText}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("overview")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <OverviewRow
                icon={<Banknote className="size-4" />}
                label={t("salary")}
                value={salaryText(job, tJobs("salaryNegotiable"))}
              />
              <Separator />
              <OverviewRow
                icon={<Clock3 className="size-4" />}
                label={t("duration")}
                value={
                  job.contractDurationMonths
                    ? t("durationMonths", { count: job.contractDurationMonths })
                    : "—"
                }
              />
              <Separator />
              <OverviewRow
                icon={<Users className="size-4" />}
                label={t("vacancies")}
                value={String(job.vacancies)}
              />
              <Separator />
              <OverviewRow
                icon={<MapPin className="size-4" />}
                label={t("location")}
                value={[job.city, job.country].filter(Boolean).join(", ")}
              />
              {job.deadline && (
                <>
                  <Separator />
                  <OverviewRow
                    icon={<CalendarClock className="size-4" />}
                    label={t("deadline")}
                    value={format(new Date(job.deadline), "d MMM yyyy")}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <div className="lg:sticky lg:top-4">
            <ApplyAction full />
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
