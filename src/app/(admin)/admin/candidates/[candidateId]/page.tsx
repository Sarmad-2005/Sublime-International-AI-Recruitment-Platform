import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
} from "lucide-react";

import { adminService, authService } from "@/lib/services";
import { ROUTES, ADMIN_ROLES, CANDIDATE_TIER_LABELS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AddToPoolModal,
  CandidateNotesPanel,
  InterviewRecordingPlayer,
  StageProgressBar,
  TierOverrideModal,
} from "@/components/admin/candidate";
import { MoveStageSelectorClient } from "./_components/MoveStageSelectorClient";
import { ApplicationSelectorClient } from "./_components/ApplicationSelectorClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}): Promise<Metadata> {
  const { candidateId } = await params;
  const [data, t] = await Promise.all([
    adminService.getCandidateDetail(candidateId),
    getTranslations("admin.candidates.meta"),
  ]);
  return {
    title: data
      ? t("detailTitle", { name: data.candidate.fullName })
      : t("detailFallback"),
  };
}

const TIER_BADGE: Record<string, string> = {
  DIAMOND: "bg-cyan-50 text-cyan-700 border-cyan-200",
  PLATINUM: "bg-slate-100 text-slate-600 border-slate-200",
  GOLD: "bg-amber-50 text-amber-700 border-amber-200",
  BRONZE: "bg-orange-50 text-orange-700 border-orange-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
  PENDING: "bg-muted text-muted-foreground border-border",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-2 border-b last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {score !== null ? `${score.toFixed(1)}%` : "—"}
        </span>
      </div>
      {score !== null && (
        <div className="bg-muted h-2 rounded-full overflow-hidden">
          <div
            className="bg-royal h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ candidateId: string }>;
  searchParams: Promise<{ applicationId?: string }>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const [{ candidateId }, sp] = await Promise.all([params, searchParams]);
  const [data, saudiClients, t] = await Promise.all([
    adminService.getCandidateDetail(candidateId),
    adminService.getSaudiClients(),
    getTranslations("admin.candidates.detail"),
  ]);

  if (!data) notFound();

  const { candidate, applications, notes, userEmail, userPhone } = data;

  const selectedApp =
    applications.find((a) => a.id === sp.applicationId) ?? applications[0] ?? null;

  const initials = candidate.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`${ROUTES.ADMIN}/candidates`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border-2 border-border">
              {candidate.profilePhotoUrl && (
                <AvatarImage src={candidate.profilePhotoUrl} alt={candidate.fullName} />
              )}
              <AvatarFallback className="bg-royal/10 text-royal text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold">{candidate.fullName}</h1>
              <p className="text-muted-foreground text-sm">
                {candidate.primaryTrade} · {candidate.city}
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {userEmail}
                {userPhone && ` · ${userPhone}`}
              </p>
            </div>
          </div>

          {/* Top action bar */}
          {selectedApp && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("text-xs font-semibold", TIER_BADGE[selectedApp.tier])}
              >
                {CANDIDATE_TIER_LABELS[selectedApp.tier]}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {APPLICATION_STATUS_LABELS[selectedApp.status] ?? selectedApp.status}
              </span>

              <TierOverrideModal
                applicationId={selectedApp.id}
                currentTier={selectedApp.tier}
                candidateName={candidate.fullName}
              />
              <AddToPoolModal
                applicationId={selectedApp.id}
                saudiClients={saudiClients}
                candidateName={candidate.fullName}
              />
              <MoveStageSelectorClient applicationId={selectedApp.id} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage progress bar */}
      {selectedApp && (
        <Card>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
              {t("pipelineStage")}
            </p>
            <StageProgressBar status={selectedApp.status as ApplicationStatus} />
          </CardContent>
        </Card>
      )}

      {/* Application selector if multiple */}
      {applications.length > 1 && selectedApp && (
        <ApplicationSelectorClient
          applications={applications.map((a) => ({
            id: a.id,
            jobTitle: a.jobTitle,
            appliedAt: a.appliedAt,
          }))}
          selectedId={selectedApp.id}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
          <TabsTrigger value="assessment">{t("tabs.assessment")}</TabsTrigger>
          <TabsTrigger value="interview">{t("tabs.interview")}</TabsTrigger>
          <TabsTrigger value="tier">{t("tabs.tier")}</TabsTrigger>
          <TabsTrigger value="applications">
            {t("tabs.applications")}
            {applications.length > 1 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {applications.length}
              </span>
            )}
          </TabsTrigger>
          {selectedApp?.postSelection && (
            <TabsTrigger value="post-selection">{t("tabs.postSelection")}</TabsTrigger>
          )}
          <TabsTrigger value="notes">
            {t("tabs.notes")}
            {notes.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {notes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Profile ── */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  {t("profile.personal")}
                </p>
                <InfoRow label={t("profile.fullName")} value={candidate.fullName} />
                <InfoRow label={t("profile.fatherName")} value={candidate.fatherName} />
                <InfoRow label={t("profile.cnic")} value={candidate.cnic} />
                <InfoRow label={t("profile.dateOfBirth")} value={candidate.dateOfBirth} />
                <InfoRow label={t("profile.gender")} value={candidate.gender} />
                <InfoRow label={t("profile.nationality")} value={candidate.nationality} />
                <InfoRow label={t("profile.maritalStatus")} value={candidate.maritalStatus} />
                <InfoRow label={t("profile.religion")} value={candidate.religion} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  {t("profile.contactAddress")}
                </p>
                <InfoRow label={t("profile.email")} value={userEmail} />
                <InfoRow label={t("profile.phone")} value={userPhone} />
                <InfoRow label={t("profile.city")} value={candidate.city} />
                <InfoRow label={t("profile.province")} value={candidate.province} />
                <InfoRow label={t("profile.country")} value={candidate.country} />
                <InfoRow label={t("profile.permanentAddress")} value={candidate.permanentAddress} />
                <InfoRow label={t("profile.currentAddress")} value={candidate.currentAddress} />
                <InfoRow label={t("profile.postalCode")} value={candidate.postalCode} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  {t("profile.passport")}
                </p>
                <InfoRow label={t("profile.passportNumber")} value={candidate.passportNumber} />
                <InfoRow label={t("profile.issueDate")} value={candidate.passportIssueDate} />
                <InfoRow label={t("profile.expiryDate")} value={candidate.passportExpiryDate} />
                <InfoRow label={t("profile.issuePlace")} value={candidate.passportIssuePlace} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  {t("profile.professional")}
                </p>
                <InfoRow label={t("profile.primaryTrade")} value={candidate.primaryTrade} />
                <InfoRow label={t("profile.secondaryTrade")} value={candidate.secondaryTrade} />
                <InfoRow
                  label={t("profile.experience")}
                  value={t("profile.experienceYears", { years: candidate.yearsOfExperience })}
                />
                <InfoRow label={t("profile.education")} value={candidate.educationLevel} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  {t("profile.emergencyContact")}
                </p>
                <InfoRow label={t("profile.name")} value={candidate.emergencyContactName} />
                <InfoRow label={t("profile.relation")} value={candidate.emergencyContactRelation} />
                <InfoRow label={t("profile.phone")} value={candidate.emergencyContactPhone} />
                <InfoRow label={t("profile.address")} value={candidate.emergencyContactAddress} />
              </CardContent>
            </Card>

            {/* CV viewer */}
            {candidate.cvUrl && (
              <Card className="md:col-span-2">
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      {t("profile.cv")}
                    </p>
                    <Button asChild variant="ghost" size="sm">
                      <a href={candidate.cvUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" />
                        {t("profile.openInNewTab")}
                      </a>
                    </Button>
                  </div>
                  <iframe
                    src={candidate.cvUrl}
                    title={t("profile.cvTitle")}
                    className="h-[600px] w-full rounded-md border"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Assessment ── */}
        <TabsContent value="assessment" className="mt-4">
          {!selectedApp?.assessment ? (
            <Card>
              <CardContent>
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t("assessment.none")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                    {t("assessment.result")}
                  </p>
                  <InfoRow
                    label={t("assessment.score")}
                    value={
                      selectedApp.assessment.score !== null
                        ? `${selectedApp.assessment.score.toFixed(1)}%`
                        : "—"
                    }
                  />
                  <InfoRow
                    label={t("assessment.resultLabel")}
                    value={
                      <span
                        className={cn(
                          "font-semibold",
                          selectedApp.assessment.passed
                            ? "text-emerald-600"
                            : "text-red-500",
                        )}
                      >
                        {selectedApp.assessment.passed ? t("assessment.passed") : t("assessment.failed")}
                      </span>
                    }
                  />
                  <InfoRow
                    label={t("assessment.submitted")}
                    value={
                      selectedApp.assessment.submittedAt
                        ? format(
                            new Date(selectedApp.assessment.submittedAt),
                            "d MMM yyyy HH:mm",
                          )
                        : "—"
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                    {t("assessment.integrity")}
                  </p>
                  <InfoRow
                    label={t("assessment.tabSwitches")}
                    value={String(selectedApp.assessment.tabSwitchCount)}
                  />
                  <InfoRow
                    label={t("assessment.flaggedSuspicious")}
                    value={
                      <span
                        className={cn(
                          "font-semibold",
                          selectedApp.assessment.flaggedSuspicious
                            ? "text-amber-600"
                            : "text-emerald-600",
                        )}
                      >
                        {selectedApp.assessment.flaggedSuspicious ? t("assessment.yes") : t("assessment.no")}
                      </span>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── AI Interview ── */}
        <TabsContent value="interview" className="mt-4 space-y-4">
          {!selectedApp?.interview ? (
            <Card>
              <CardContent>
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t("interview.none")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      {t("interview.scoreBreakdown")}
                    </p>
                    <ScoreBar
                      label={t("interview.overall")}
                      score={selectedApp.interview.overallScore}
                    />
                    <ScoreBar
                      label={t("interview.technical")}
                      score={selectedApp.interview.technicalScore}
                    />
                    <ScoreBar
                      label={t("interview.communication")}
                      score={selectedApp.interview.communicationScore}
                    />
                    <ScoreBar
                      label={t("interview.behavioral")}
                      score={selectedApp.interview.behavioralScore}
                    />
                    <ScoreBar
                      label={t("interview.confidence")}
                      score={selectedApp.interview.confidenceScore}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                      {t("interview.aiSummary")}
                    </p>
                    {selectedApp.interview.aiSummary ? (
                      <p className="text-sm leading-relaxed">
                        {selectedApp.interview.aiSummary}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {t("interview.noSummary")}
                      </p>
                    )}
                    <div className="mt-4 space-y-1.5">
                      <InfoRow
                        label={t("interview.status")}
                        value={selectedApp.interview.status}
                      />
                      <InfoRow
                        label={t("interview.completed")}
                        value={
                          selectedApp.interview.completedAt
                            ? format(
                                new Date(selectedApp.interview.completedAt),
                                "d MMM yyyy HH:mm",
                              )
                            : "—"
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                    {t("interview.recording")}
                  </p>
                  <InterviewRecordingPlayer
                    url={selectedApp.interview.recordingUrl}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Tier ── */}
        <TabsContent value="tier" className="mt-4">
          {!selectedApp?.tierRecord ? (
            <Card>
              <CardContent>
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t("tier.none")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                    {t("tier.assignment")}
                  </p>
                  <InfoRow
                    label={t("tier.tierLabel")}
                    value={
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold",
                          TIER_BADGE[selectedApp.tierRecord.tier],
                        )}
                      >
                        {CANDIDATE_TIER_LABELS[selectedApp.tierRecord.tier]}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label={t("tier.finalScore")}
                    value={
                      selectedApp.tierRecord.finalScore !== null
                        ? `${selectedApp.tierRecord.finalScore.toFixed(2)}%`
                        : "—"
                    }
                  />
                  <InfoRow
                    label={t("tier.adminOverride")}
                    value={
                      selectedApp.tierRecord.adminOverride ? (
                        <span className="text-amber-600 font-semibold">{t("tier.overrideYes")}</span>
                      ) : (
                        t("tier.overrideNo")
                      )
                    }
                  />
                  {selectedApp.tierRecord.adminOverride && (
                    <InfoRow
                      label={t("tier.overrideReason")}
                      value={selectedApp.tierRecord.adminOverrideNote}
                    />
                  )}
                  <InfoRow
                    label={t("tier.assigned")}
                    value={
                      selectedApp.tierRecord.assignedAt
                        ? format(
                            new Date(selectedApp.tierRecord.assignedAt),
                            "d MMM yyyy HH:mm",
                          )
                        : "—"
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                    {t("tier.calculation")}
                  </p>
                  <div className="space-y-3">
                    <ScoreBar
                      label={t("tier.assessmentWeight", {
                        weight: (selectedApp.tierRecord.assessmentWeight * 100).toFixed(0),
                      })}
                      score={selectedApp.tierRecord.assessmentScore}
                    />
                    <ScoreBar
                      label={t("tier.interviewWeight", {
                        weight: (selectedApp.tierRecord.interviewWeight * 100).toFixed(0),
                      })}
                      score={selectedApp.tierRecord.interviewScore}
                    />
                    <div className="border-t pt-2">
                      <ScoreBar
                        label={t("tier.weightedFinal")}
                        score={selectedApp.tierRecord.finalScore}
                      />
                    </div>
                  </div>
                  {selectedApp && (
                    <div className="mt-4">
                      <TierOverrideModal
                        applicationId={selectedApp.id}
                        currentTier={selectedApp.tier}
                        candidateName={candidate.fullName}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Applications ── */}
        <TabsContent value="applications" className="mt-4">
          <Card>
            <CardContent>
              {applications.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t("applications.empty")}
                </p>
              ) : (
                <div className="divide-y">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className={cn(
                        "flex items-start justify-between gap-4 py-4",
                        app.id === selectedApp?.id && "bg-royal/5 -mx-4 px-4",
                      )}
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{app.jobTitle}</p>
                        <p className="text-muted-foreground text-sm">
                          {app.companyName} ·{" "}
                          {format(new Date(app.appliedAt), "d MMM yyyy")}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-medium">
                            {APPLICATION_STATUS_LABELS[app.status] ?? app.status}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px] font-semibold",
                              TIER_BADGE[app.tier],
                            )}
                          >
                            {CANDIDATE_TIER_LABELS[app.tier]}
                          </Badge>
                          {app.finalScore !== null && (
                            <span className="text-muted-foreground text-xs">
                              {t("applications.score", { score: app.finalScore.toFixed(1) })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href={`${ROUTES.ADMIN}/candidates/${candidateId}?applicationId=${app.id}`}
                        >
                          <FileText className="size-4" />
                          {t("applications.view")}
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Post-Selection ── */}
        {selectedApp?.postSelection && (
          <TabsContent value="post-selection" className="mt-4">
            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  {t("postSelection.title")}
                </p>
                <div className="divide-y">
                  <InfoRow
                    label={t("postSelection.offerLetter")}
                    value={selectedApp.postSelection.offerLetterStatus}
                  />
                  <InfoRow
                    label={t("postSelection.gamca")}
                    value={selectedApp.postSelection.gamcaStatus}
                  />
                  <InfoRow
                    label={t("postSelection.visa")}
                    value={selectedApp.postSelection.visaStatus}
                  />
                  <InfoRow
                    label={t("postSelection.ticket")}
                    value={selectedApp.postSelection.ticketArrangement}
                  />
                  <InfoRow
                    label={t("postSelection.preDeparture")}
                    value={selectedApp.postSelection.preDepartureBriefStatus}
                  />
                  <InfoRow
                    label={t("postSelection.arrival")}
                    value={selectedApp.postSelection.arrivalStatus}
                  />
                  <InfoRow
                    label={t("postSelection.probation")}
                    value={selectedApp.postSelection.probationStatus}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Notes ── */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent>
              <CandidateNotesPanel
                candidateId={candidateId}
                initialNotes={notes}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
