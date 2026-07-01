import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import {
  Banknote,
  Building2,
  Calendar,
  ChevronLeft,
  Clock,
  Edit2,
  MapPin,
  Users,
  ClipboardList,
  Video,
} from "lucide-react";

import { authService, jobPostService } from "@/lib/services";
import { ROUTES, USER_ROLES, JOB_SECTOR_LABELS, JOB_BENEFIT_LABELS, type JobBenefit } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ApplicationFunnelMini } from "@/components/admin/jobs";
import { JobStatusActions } from "./_components/JobStatusActions";
import type { JobPostStatus } from "@/lib/constants";

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { jobId } = await params;
  const detail = await jobPostService.getJobPostDetail(jobId);
  return { title: detail ? `${detail.title} — SIORP Admin` : "Job Post" };
}

const STATUS_BADGE: Record<JobPostStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
  ACTIVE: { label: "Active", className: "bg-green-50 text-green-700 border-green-200" },
  CLOSED: { label: "Closed", className: "bg-orange-50 text-orange-700 border-orange-200" },
  FILLED: { label: "Filled", className: "bg-blue-50 text-blue-700 border-blue-200" },
};

export default async function JobDetailPage({ params }: PageProps) {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const { jobId } = await params;

  const [detail, metrics] = await Promise.all([
    jobPostService.getJobPostDetail(jobId),
    jobPostService.getJobPostMetrics(jobId),
  ]);

  if (!detail) notFound();

  const sectorLabel =
    JOB_SECTOR_LABELS[detail.sector as keyof typeof JOB_SECTOR_LABELS] ?? detail.sector;

  const statusCfg = STATUS_BADGE[detail.status] ?? STATUS_BADGE.DRAFT;
  const deadline = detail.applicationDeadline ? new Date(detail.applicationDeadline) : null;
  const isExpired = deadline ? deadline < new Date() : false;

  const salary =
    detail.salaryMin && detail.salaryMax
      ? `${detail.salaryCurrency} ${detail.salaryMin.toLocaleString()} – ${detail.salaryMax.toLocaleString()} / month`
      : detail.salaryMin
        ? `From ${detail.salaryCurrency} ${detail.salaryMin.toLocaleString()} / month`
        : detail.salaryMax
          ? `Up to ${detail.salaryCurrency} ${detail.salaryMax.toLocaleString()} / month`
          : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-0.5 size-8 shrink-0">
            <Link href={`${ROUTES.ADMIN}/jobs`}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{detail.title}</h1>
              <Badge
                variant="outline"
                className={`text-xs font-medium ${statusCfg.className}`}
              >
                {statusCfg.label}
              </Badge>
            </div>
            <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
              <Building2 className="size-4" />
              {detail.companyName}
              <span>·</span>
              {sectorLabel}
              <span>·</span>
              Created {format(new Date(detail.createdAt), "d MMM yyyy")}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <JobStatusActions jobId={jobId} status={detail.status} />
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`${ROUTES.ADMIN}/jobs/${jobId}/edit`}>
              <Edit2 className="size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---- Left column: job info ---- */}
        <div className="space-y-6 lg:col-span-2">

          {/* Quick facts */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoCard icon={<MapPin className="size-4" />} label="Location">
              {[detail.city, detail.country].filter(Boolean).join(", ")}
            </InfoCard>
            <InfoCard icon={<Users className="size-4" />} label="Vacancies">
              {detail.vacancies} position{detail.vacancies !== 1 ? "s" : ""}
            </InfoCard>
            {salary && (
              <InfoCard icon={<Banknote className="size-4" />} label="Salary">
                {salary}
              </InfoCard>
            )}
            {detail.contractDurationMonths && (
              <InfoCard icon={<Clock className="size-4" />} label="Contract">
                {detail.contractDurationMonths} months
              </InfoCard>
            )}
            {deadline && (
              <InfoCard
                icon={<Calendar className="size-4" />}
                label="Deadline"
                className={isExpired ? "border-red-200 bg-red-50" : undefined}
              >
                <span className={isExpired ? "text-red-600" : undefined}>
                  {format(deadline, "d MMM yyyy")}
                  {isExpired && " (expired)"}
                </span>
              </InfoCard>
            )}
          </div>

          {/* Description */}
          {detail.description && (
            <Section title="Job Description">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: detail.description }}
              />
            </Section>
          )}

          {/* Qualifications */}
          {detail.requiredQualifications && (
            <Section title="Required Qualifications">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: detail.requiredQualifications }}
              />
            </Section>
          )}

          {/* Benefits */}
          {detail.benefits.length > 0 && (
            <Section title="Benefits">
              <div className="flex flex-wrap gap-2">
                {detail.benefits.map((b) => (
                  <Badge key={b} variant="secondary">
                    {JOB_BENEFIT_LABELS[b as JobBenefit] ?? b}
                  </Badge>
                ))}
              </div>
            </Section>
          )}

          {/* Assessment config */}
          <Section title="Assessment & Interview">
            <div className="space-y-3">
              <AssessmentRow
                icon={<ClipboardList className="size-5" />}
                label="Trade Assessment"
                href={detail.assessment ? `${ROUTES.ADMIN}/jobs/${jobId}/assessment` : undefined}
              >
                {detail.assessment ? (
                  <div className="text-sm">
                    <p className="font-medium">{detail.assessment.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {detail.assessment.totalQuestions} questions ·{" "}
                      {detail.assessment.timeLimitMinutes} min ·{" "}
                      <span className="text-amber-600 font-medium">
                        Pass: {detail.assessment.passingScore}%
                      </span>
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Not configured</span>
                )}
              </AssessmentRow>

              <Separator />

              <AssessmentRow
                icon={<Video className="size-5" />}
                label="AI Interview Set"
                href={detail.interviewSet ? `${ROUTES.ADMIN}/jobs/${jobId}/interview-set` : undefined}
              >
                {detail.interviewSet ? (
                  <div className="text-sm">
                    <p className="font-medium">{detail.interviewSet.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {detail.interviewSet.questionCount} questions ·{" "}
                      {detail.interviewSet.maxDurationMinutes} min max
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Not configured</span>
                )}
              </AssessmentRow>

              <Separator />

              <div className="flex items-center gap-6 pt-1 text-sm">
                <span className="text-muted-foreground">Scoring Weights:</span>
                <span>Assessment <strong>{detail.assessmentWeight}%</strong></span>
                <span>Interview <strong>{detail.interviewWeight}%</strong></span>
              </div>
            </div>
          </Section>

          {/* Tier thresholds */}
          {detail.tierThresholds && (
            <Section title="Tier Thresholds">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Diamond", value: detail.tierThresholds.diamondMin, color: "text-cyan-600" },
                  { label: "Platinum", value: detail.tierThresholds.platinumMin, color: "text-slate-500" },
                  { label: "Gold", value: detail.tierThresholds.goldMin, color: "text-amber-500" },
                  { label: "Bronze", value: detail.tierThresholds.bronzeMin, color: "text-orange-500" },
                ].map((t) => (
                  <div key={t.label} className="rounded-md border px-3 py-2 text-center">
                    <p className={`text-lg font-bold ${t.color}`}>≥{t.value}%</p>
                    <p className="text-muted-foreground text-xs">{t.label}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ---- Right column: application funnel ---- */}
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Application Funnel</h3>
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                <Link href={`${ROUTES.ADMIN}/candidates?jobPostId=${jobId}`}>
                  View all →
                </Link>
              </Button>
            </div>
            <ApplicationFunnelMini metrics={metrics} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  children,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-md border bg-gray-50 px-3 py-2.5 ${className ?? ""}`}>
      <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function AssessmentRow({
  icon,
  label,
  children,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground mb-0.5 text-xs font-medium uppercase tracking-wider">
          {label}
        </p>
        {children}
      </div>
      {href && (
        <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs">
          <Link href={href}>Configure →</Link>
        </Button>
      )}
    </div>
  );
}
