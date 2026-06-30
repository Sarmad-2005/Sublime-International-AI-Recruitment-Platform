import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileWarning,
  ListChecks,
  Maximize,
  MonitorX,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";

import { authService, candidateService, assessmentService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StartAssessmentButton } from "@/components/candidate/assessment";
import type { AssessmentConfigDTO } from "@/types";

export const metadata: Metadata = {
  title: "Trade Assessment — SIORP",
};

/** Three stat tiles summarising the assessment rules. */
function AssessmentStats({ config }: { config: AssessmentConfigDTO }) {
  const stats = [
    { icon: ListChecks, label: "Questions", value: `${config.totalQuestions}` },
    { icon: Clock, label: "Time limit", value: `${config.timeLimitMinutes} min` },
    { icon: Target, label: "Passing score", value: `${config.passingScore}%` },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-muted/40 flex flex-col items-center gap-1 rounded-lg border p-4 text-center"
        >
          <s.icon className="text-royal size-5" />
          <span className="text-xl font-bold tabular-nums">{s.value}</span>
          <span className="text-muted-foreground text-xs">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const RULES = [
  { icon: MonitorX, text: "Do not switch tabs or windows. Switching is recorded, and 3 switches auto-submit your assessment." },
  { icon: Maximize, text: "Full screen is required on desktop. Leaving full screen is flagged." },
  { icon: Clock, text: "The timer keeps running if you refresh or navigate away. It does not pause." },
  { icon: AlertTriangle, text: "You can't change your answers once submitted." },
];

/** The instructions + start/resume/retake screen. */
function InstructionsScreen({
  applicationId,
  config,
  ctaLabel,
}: {
  applicationId: string;
  config: AssessmentConfigDTO;
  ctaLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="text-royal size-5" />
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {config.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {config.description}
          </p>
        )}

        <AssessmentStats config={config} />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Before you start</h3>
          <ul className="space-y-2.5">
            {RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <rule.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <span>{rule.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row-reverse sm:items-center sm:justify-start">
          <StartAssessmentButton applicationId={applicationId} label={ctaLabel} />
          <p className="text-muted-foreground text-xs">
            Starting begins the timer immediately.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** A centred status card for terminal / blocked states. */
function StatusScreen({
  tone,
  icon: Icon,
  title,
  children,
  actions,
}: {
  tone: "success" | "error" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const toneClasses = {
    success: "bg-emerald-100 text-emerald-600",
    error: "bg-red-100 text-red-600",
    neutral: "bg-muted text-muted-foreground",
  }[tone];

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className={`grid size-16 place-items-center rounded-full ${toneClasses}`}>
          <Icon className="size-8" />
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="text-muted-foreground max-w-md space-y-2 text-sm">
          {children}
        </div>
        {actions && <div className="flex flex-wrap justify-center gap-3 pt-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}

export default async function AssessmentEntryPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    redirect(ROUTES.LOGIN);
  }

  const { applicationId } = await params;
  const profile = await candidateService.getCandidateProfile(user.id);
  const entry = profile
    ? await assessmentService.getAssessmentEntry(applicationId, profile.id)
    : null;

  if (!entry) notFound();

  const applicationHref = `${ROUTES.CANDIDATE}/applications/${applicationId}`;
  const resultHref = `/assessment/${applicationId}/result`;
  const score = entry.attempt?.score != null ? Math.round(entry.attempt.score) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link href={applicationHref}>
          <ArrowLeft className="size-4" />
          Back to application
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Trade Assessment</h1>
        <p className="text-muted-foreground text-sm">
          {entry.jobTitle} · {entry.companyName}
        </p>
      </div>

      {(entry.state === "ELIGIBLE" ||
        entry.state === "IN_PROGRESS" ||
        entry.state === "FAILED_RETAKE") &&
        entry.config && (
          <InstructionsScreen
            applicationId={applicationId}
            config={entry.config}
            ctaLabel={
              entry.state === "IN_PROGRESS"
                ? "Resume Assessment"
                : entry.state === "FAILED_RETAKE"
                  ? "Retake Assessment"
                  : "Start Assessment"
            }
          />
        )}

      {entry.state === "FAILED_RETAKE" && score != null && (
        <p className="text-muted-foreground text-center text-sm">
          Your previous score was <strong>{score}%</strong>. Passing score is{" "}
          {entry.config?.passingScore}%.
        </p>
      )}

      {entry.state === "PASSED" && (
        <StatusScreen
          tone="success"
          icon={Trophy}
          title="Assessment passed"
          actions={
            <>
              <Button asChild variant="brand">
                <Link href={resultHref}>
                  View result
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={applicationHref}>Back to application</Link>
              </Button>
            </>
          }
        >
          {score != null && (
            <p>
              You scored <strong className="text-foreground">{score}%</strong>. Check your
              email for your AI interview invitation — the next step in your application.
            </p>
          )}
        </StatusScreen>
      )}

      {entry.state === "FAILED_COOLDOWN" && (
        <StatusScreen
          tone="error"
          icon={XCircle}
          title="Assessment not passed"
          actions={
            <Button asChild variant="outline">
              <Link href={resultHref}>View detailed result</Link>
            </Button>
          }
        >
          {score != null && (
            <p>
              You scored <strong className="text-foreground">{score}%</strong>. Passing
              score is {entry.config?.passingScore}%.
            </p>
          )}
          {entry.retake?.availableAt && (
            <p>
              You may retake this assessment after{" "}
              <strong className="text-foreground">
                {format(new Date(entry.retake.availableAt), "d MMM yyyy, h:mm a")}
              </strong>
              .
            </p>
          )}
        </StatusScreen>
      )}

      {entry.state === "FAILED_FINAL" && (
        <StatusScreen
          tone="error"
          icon={XCircle}
          title="Assessment not passed"
          actions={
            <Button asChild variant="outline">
              <Link href={resultHref}>View detailed result</Link>
            </Button>
          }
        >
          {score != null && (
            <p>
              You scored <strong className="text-foreground">{score}%</strong>. Passing
              score is {entry.config?.passingScore}%. Retakes aren&apos;t available for
              this assessment.
            </p>
          )}
        </StatusScreen>
      )}

      {entry.state === "NO_CV" && (
        <StatusScreen
          tone="neutral"
          icon={FileWarning}
          title="Submit your CV first"
          actions={
            <Button asChild variant="brand">
              <Link href={applicationHref}>Go to application</Link>
            </Button>
          }
        >
          <p>
            You need to submit a CV for this job before you can take the trade
            assessment.
          </p>
        </StatusScreen>
      )}

      {entry.state === "NOT_CONFIGURED" && (
        <StatusScreen
          tone="neutral"
          icon={ClipboardList}
          title="No assessment yet"
          actions={
            <Button asChild variant="outline">
              <Link href={applicationHref}>Back to application</Link>
            </Button>
          }
        >
          <p>
            There&apos;s no trade assessment set up for this role yet. We&apos;ll notify
            you when it&apos;s ready.
          </p>
        </StatusScreen>
      )}

      {entry.state === "ALREADY_ADVANCED" && (
        <StatusScreen
          tone="success"
          icon={CheckCircle2}
          title="You've moved on"
          actions={
            <Button asChild variant="brand">
              <Link href={applicationHref}>View application status</Link>
            </Button>
          }
        >
          <p>
            Your application has already progressed past the trade assessment. Track your
            next steps from your application page.
          </p>
        </StatusScreen>
      )}
    </div>
  );
}
