import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  GraduationCap,
  Briefcase,
  Globe,
  Sparkles,
} from "lucide-react";

import { authService, clientPortalService } from "@/lib/services";
import {
  EDUCATION_LEVEL_LABELS,
  ROUTES,
  USER_ROLES,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/client/TierBadge";
import { ScoreBar } from "@/components/client/ScoreBar";
import { CandidateActions } from "@/components/client/CandidateActions";
import { ClientRecordingPlayer } from "@/components/client/ClientRecordingPlayer";

export const metadata: Metadata = {
  title: "Candidate Profile — Sublime International",
};

interface ProfilePageProps {
  params: Promise<{ applicationId: string }>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)
  ).toUpperCase();
}

/** Client-facing candidate profile (Server Component). Reduced PII by design. */
export default async function ClientCandidateProfilePage({
  params,
}: ProfilePageProps) {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.SAUDI_CLIENT) {
    redirect(ROUTES.LOGIN);
  }

  const { applicationId } = await params;
  const candidate = await clientPortalService.getCandidateProfileForClient(
    user.id,
    applicationId,
  );
  if (!candidate) notFound();

  const qualifications = [
    {
      icon: GraduationCap,
      label: "Education",
      value: EDUCATION_LEVEL_LABELS[candidate.educationLevel] ?? "—",
    },
    {
      icon: Briefcase,
      label: "Primary Trade",
      value: candidate.primaryTrade,
    },
    {
      icon: Award,
      label: "Experience",
      value: `${candidate.yearsOfExperience} year${candidate.yearsOfExperience === 1 ? "" : "s"}`,
    },
    {
      icon: Globe,
      label: "Nationality",
      value: candidate.nationality,
    },
  ];
  if (candidate.secondaryTrade) {
    qualifications.splice(2, 0, {
      icon: Briefcase,
      label: "Secondary Trade",
      value: candidate.secondaryTrade,
    });
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link href={`${ROUTES.CLIENT}/pool`}>
          <ArrowLeft className="size-4" />
          Back to Talent Pool
        </Link>
      </Button>

      {/* Hero */}
      <Card className="bg-navy border-navy text-white">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="size-20 border-2 border-white/30">
            {candidate.profilePhotoUrl && (
              <AvatarImage
                src={candidate.profilePhotoUrl}
                alt={candidate.fullName}
              />
            )}
            <AvatarFallback className="bg-white/10 text-xl font-semibold text-white">
              {initials(candidate.fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{candidate.fullName}</h1>
            <p className="mt-0.5 text-sm text-white/70">
              {candidate.jobTitle}
            </p>
            <div className="mt-3">
              <TierBadge tier={candidate.tier} size="md" />
            </div>
          </div>

          <div className="text-center sm:pr-4">
            <p className="text-5xl leading-none font-bold tabular-nums">
              {candidate.finalScore == null
                ? "—"
                : Math.round(candidate.finalScore)}
            </p>
            <p className="mt-1 text-xs tracking-wide text-white/60 uppercase">
              Final Score
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: recording + summary */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Interview Recording</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientRecordingPlayer
                url={candidate.recordingUrl}
                companyName={candidate.companyName}
              />
            </CardContent>
          </Card>

          {candidate.aiSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="text-royal size-5" />
                  AI Assessment Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {candidate.aiSummary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Score breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interview Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <ScoreBar
                label="Technical"
                value={candidate.scores.technical}
                color="navy"
              />
              <ScoreBar
                label="Communication"
                value={candidate.scores.communication}
                color="royal"
              />
              <ScoreBar
                label="Behavioral"
                value={candidate.scores.behavioral}
                color="gold"
              />
              <ScoreBar
                label="Confidence"
                value={candidate.scores.confidence}
                color="emerald"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: qualifications + assessment + actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Qualifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qualifications.map((q) => {
                const Icon = q.icon;
                return (
                  <div key={q.label} className="flex items-start gap-3">
                    <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-md">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">{q.label}</p>
                      <p className="text-sm font-medium">{q.value}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeCheck className="text-royal size-5" />
                Assessment Highlights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScoreBar
                label="Trade Assessment"
                value={candidate.assessmentScore}
                color="gold"
              />
              {candidate.assessmentPassed != null && (
                <span
                  className={
                    candidate.assessmentPassed
                      ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      : "inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200"
                  }
                >
                  {candidate.assessmentPassed ? "Passed" : "Did not pass"}
                </span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Decision</CardTitle>
            </CardHeader>
            <CardContent>
              <CandidateActions
                applicationId={candidate.applicationId}
                status={candidate.clientStatus}
                variant="detail"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
