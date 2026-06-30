import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  Flag,
  Mail,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { authService, candidateService, assessmentService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata: Metadata = {
  title: "Assessment Result — SIORP",
};

export default async function AssessmentResultPage({
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
  const result = profile
    ? await assessmentService.getAttemptResult(applicationId, profile.id)
    : null;

  // No submitted attempt → send them to the entry screen to take it.
  if (!result) redirect(`/assessment/${applicationId}`);

  const { passed } = result;
  const applicationHref = `${ROUTES.CANDIDATE}/applications/${applicationId}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">Assessment Result</h1>
        <p className="text-muted-foreground text-sm">
          {result.jobTitle} · {result.companyName}
        </p>
      </div>

      {/* Score hero */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div
            className={cn(
              "grid size-16 place-items-center rounded-full",
              passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600",
            )}
          >
            {passed ? <CheckCircle2 className="size-8" /> : <XCircle className="size-8" />}
          </div>

          <div className="space-y-1">
            <p
              className={cn(
                "text-6xl font-extrabold tabular-nums",
                passed ? "text-emerald-600" : "text-red-600",
              )}
            >
              {result.score}%
            </p>
            <p className="text-muted-foreground text-sm">
              {result.correctCount} of {result.totalQuestions} correct · passing score{" "}
              {result.passingScore}%
            </p>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold",
              passed ? "bg-emerald-600 text-white" : "bg-red-600 text-white",
            )}
          >
            {passed ? "✅ Passed" : "❌ Not passed"}
          </span>

          {result.flaggedSuspicious && (
            <p className="text-amber-600 flex items-center gap-1.5 text-xs">
              <Flag className="size-3.5" />
              This attempt was flagged for review (tab switching / leaving full screen).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Category breakdown */}
      {result.categories.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown by category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.categories.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{cat.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {cat.correct}/{cat.total} · {cat.percentage}%
                  </span>
                </div>
                <Progress
                  value={cat.percentage}
                  indicatorClassName={cat.percentage >= result.passingScore ? "bg-emerald-600" : "bg-amber-500"}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Next steps */}
      <Card>
        <CardContent className="space-y-4 py-6">
          {passed ? (
            <div className="flex items-start gap-3">
              <div className="bg-royal/10 text-royal grid size-10 shrink-0 place-items-center rounded-full">
                <Mail className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold">Congratulations! 🎉</h3>
                <p className="text-muted-foreground text-sm">
                  Check your email for your AI interview invitation — it&apos;s the next
                  step in your application. The link is valid for 72 hours.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-full">
                <RotateCcw className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold">What&apos;s next</h3>
                <p className="text-muted-foreground text-sm">
                  Your score was {result.score}%. The passing score is{" "}
                  {result.passingScore}%.{" "}
                  {result.retake?.allowed
                    ? result.retake.eligible
                      ? "You're eligible to retake the assessment now."
                      : result.retake.availableAt
                        ? `You may retake it after ${format(new Date(result.retake.availableAt), "d MMM yyyy, h:mm a")}.`
                        : "Retake availability will be confirmed soon."
                    : "Retakes aren't available for this assessment."}
                </p>
              </div>
            </div>
          )}

          <p className="text-muted-foreground border-t pt-3 text-xs">
            Submitted {format(new Date(result.submittedAt), "d MMM yyyy, h:mm a")}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        {!passed && result.retake?.allowed && result.retake.eligible && (
          <Button asChild variant="brand">
            <Link href={`/assessment/${applicationId}`}>
              <RotateCcw className="size-4" />
              Retake assessment
            </Link>
          </Button>
        )}
        <Button asChild variant={passed ? "brand" : "outline"}>
          <Link href={applicationHref}>
            Go to my application
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
