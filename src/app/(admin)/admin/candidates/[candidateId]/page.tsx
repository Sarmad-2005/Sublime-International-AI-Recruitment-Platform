import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
} from "lucide-react";

import { adminService, authService } from "@/lib/services";
import { ROUTES, USER_ROLES, CANDIDATE_TIER_LABELS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
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
  const data = await adminService.getCandidateDetail(candidateId);
  return {
    title: data
      ? `${data.candidate.fullName} — SIORP Admin`
      : "Candidate — SIORP Admin",
  };
}

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

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
  const [data, saudiClients] = await Promise.all([
    adminService.getCandidateDetail(candidateId),
    adminService.getSaudiClients(),
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
        Back to Candidates
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
              Pipeline Stage
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
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="interview">AI Interview</TabsTrigger>
          <TabsTrigger value="tier">Tier</TabsTrigger>
          <TabsTrigger value="applications">
            Applications
            {applications.length > 1 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {applications.length}
              </span>
            )}
          </TabsTrigger>
          {selectedApp?.postSelection && (
            <TabsTrigger value="post-selection">Post-Selection</TabsTrigger>
          )}
          <TabsTrigger value="notes">
            Notes
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
                  Personal Information
                </p>
                <InfoRow label="Full Name" value={candidate.fullName} />
                <InfoRow label="Father's Name" value={candidate.fatherName} />
                <InfoRow label="CNIC" value={candidate.cnic} />
                <InfoRow label="Date of Birth" value={candidate.dateOfBirth} />
                <InfoRow label="Gender" value={candidate.gender} />
                <InfoRow label="Nationality" value={candidate.nationality} />
                <InfoRow label="Marital Status" value={candidate.maritalStatus} />
                <InfoRow label="Religion" value={candidate.religion} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  Contact & Address
                </p>
                <InfoRow label="Email" value={userEmail} />
                <InfoRow label="Phone" value={userPhone} />
                <InfoRow label="City" value={candidate.city} />
                <InfoRow label="Province" value={candidate.province} />
                <InfoRow label="Country" value={candidate.country} />
                <InfoRow label="Permanent Address" value={candidate.permanentAddress} />
                <InfoRow label="Current Address" value={candidate.currentAddress} />
                <InfoRow label="Postal Code" value={candidate.postalCode} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  Passport
                </p>
                <InfoRow label="Passport Number" value={candidate.passportNumber} />
                <InfoRow label="Issue Date" value={candidate.passportIssueDate} />
                <InfoRow label="Expiry Date" value={candidate.passportExpiryDate} />
                <InfoRow label="Issue Place" value={candidate.passportIssuePlace} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  Professional
                </p>
                <InfoRow label="Primary Trade" value={candidate.primaryTrade} />
                <InfoRow label="Secondary Trade" value={candidate.secondaryTrade} />
                <InfoRow
                  label="Experience"
                  value={`${candidate.yearsOfExperience} year${candidate.yearsOfExperience !== 1 ? "s" : ""}`}
                />
                <InfoRow label="Education" value={candidate.educationLevel} />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                  Emergency Contact
                </p>
                <InfoRow label="Name" value={candidate.emergencyContactName} />
                <InfoRow label="Relation" value={candidate.emergencyContactRelation} />
                <InfoRow label="Phone" value={candidate.emergencyContactPhone} />
                <InfoRow label="Address" value={candidate.emergencyContactAddress} />
              </CardContent>
            </Card>

            {/* CV viewer */}
            {candidate.cvUrl && (
              <Card className="md:col-span-2">
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      CV / Resume
                    </p>
                    <Button asChild variant="ghost" size="sm">
                      <a href={candidate.cvUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" />
                        Open in new tab
                      </a>
                    </Button>
                  </div>
                  <iframe
                    src={candidate.cvUrl}
                    title="Candidate CV"
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
                  No trade assessment attempt for this application.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                    Assessment Result
                  </p>
                  <InfoRow
                    label="Score"
                    value={
                      selectedApp.assessment.score !== null
                        ? `${selectedApp.assessment.score.toFixed(1)}%`
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Result"
                    value={
                      <span
                        className={cn(
                          "font-semibold",
                          selectedApp.assessment.passed
                            ? "text-emerald-600"
                            : "text-red-500",
                        )}
                      >
                        {selectedApp.assessment.passed ? "Passed" : "Failed"}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Submitted"
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
                    Integrity
                  </p>
                  <InfoRow
                    label="Tab Switches"
                    value={String(selectedApp.assessment.tabSwitchCount)}
                  />
                  <InfoRow
                    label="Flagged Suspicious"
                    value={
                      <span
                        className={cn(
                          "font-semibold",
                          selectedApp.assessment.flaggedSuspicious
                            ? "text-amber-600"
                            : "text-emerald-600",
                        )}
                      >
                        {selectedApp.assessment.flaggedSuspicious ? "Yes ⚠" : "No"}
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
                  No AI interview attempt for this application.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      Score Breakdown
                    </p>
                    <ScoreBar
                      label="Overall"
                      score={selectedApp.interview.overallScore}
                    />
                    <ScoreBar
                      label="Technical"
                      score={selectedApp.interview.technicalScore}
                    />
                    <ScoreBar
                      label="Communication"
                      score={selectedApp.interview.communicationScore}
                    />
                    <ScoreBar
                      label="Behavioral"
                      score={selectedApp.interview.behavioralScore}
                    />
                    <ScoreBar
                      label="Confidence"
                      score={selectedApp.interview.confidenceScore}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                      AI Summary
                    </p>
                    {selectedApp.interview.aiSummary ? (
                      <p className="text-sm leading-relaxed">
                        {selectedApp.interview.aiSummary}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No AI summary available.
                      </p>
                    )}
                    <div className="mt-4 space-y-1.5">
                      <InfoRow
                        label="Status"
                        value={selectedApp.interview.status}
                      />
                      <InfoRow
                        label="Completed"
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
                    Interview Recording
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
                  No tier record yet — candidate has not completed both stages.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                    Tier Assignment
                  </p>
                  <InfoRow
                    label="Tier"
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
                    label="Final Score"
                    value={
                      selectedApp.tierRecord.finalScore !== null
                        ? `${selectedApp.tierRecord.finalScore.toFixed(2)}%`
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Admin Override"
                    value={
                      selectedApp.tierRecord.adminOverride ? (
                        <span className="text-amber-600 font-semibold">Yes</span>
                      ) : (
                        "No"
                      )
                    }
                  />
                  {selectedApp.tierRecord.adminOverride && (
                    <InfoRow
                      label="Override Reason"
                      value={selectedApp.tierRecord.adminOverrideNote}
                    />
                  )}
                  <InfoRow
                    label="Assigned"
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
                    Score Calculation
                  </p>
                  <div className="space-y-3">
                    <ScoreBar
                      label={`Assessment (weight ${(selectedApp.tierRecord.assessmentWeight * 100).toFixed(0)}%)`}
                      score={selectedApp.tierRecord.assessmentScore}
                    />
                    <ScoreBar
                      label={`AI Interview (weight ${(selectedApp.tierRecord.interviewWeight * 100).toFixed(0)}%)`}
                      score={selectedApp.tierRecord.interviewScore}
                    />
                    <div className="border-t pt-2">
                      <ScoreBar
                        label="Weighted Final Score"
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
                  No applications found.
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
                              Score: {app.finalScore.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href={`${ROUTES.ADMIN}/candidates/${candidateId}?applicationId=${app.id}`}
                        >
                          <FileText className="size-4" />
                          View
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
                  Deployment Milestones
                </p>
                <div className="divide-y">
                  <InfoRow
                    label="Offer Letter"
                    value={selectedApp.postSelection.offerLetterStatus}
                  />
                  <InfoRow
                    label="GAMCA Medical"
                    value={selectedApp.postSelection.gamcaStatus}
                  />
                  <InfoRow
                    label="Visa"
                    value={selectedApp.postSelection.visaStatus}
                  />
                  <InfoRow
                    label="Flight Ticket"
                    value={selectedApp.postSelection.ticketArrangement}
                  />
                  <InfoRow
                    label="Pre-Departure Brief"
                    value={selectedApp.postSelection.preDepartureBriefStatus}
                  />
                  <InfoRow
                    label="Arrival"
                    value={selectedApp.postSelection.arrivalStatus}
                  />
                  <InfoRow
                    label="Probation"
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
