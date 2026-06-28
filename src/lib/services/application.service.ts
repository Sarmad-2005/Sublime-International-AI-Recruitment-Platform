import "server-only";

import { prisma, Prisma } from "@/lib/prisma";
import {
  APPLICATION_STATUS_LABELS,
  POST_SELECTION_STAGES,
  POST_SELECTION_STAGE_LABELS,
  POST_SELECTION_STAGE_ORDER,
  ROUTES,
  type CandidateTier,
} from "@/lib/constants";
import { resend, EMAIL_FROM, applicationReceivedEmail } from "@/lib/email";
import { clientEnv } from "@/lib/env";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import type {
  ApplicationDetailDTO,
  ApplicationListItem,
  ApplicationPostSelection,
  ApplicationPostSelectionMilestone,
  ApplicationTimelineItem,
} from "@/types";

/**
 * Application service — the only layer that reads/writes applications for the
 * candidate portal (Rule #5). Returns JSON-safe DTOs (dates as ISO strings) so
 * the same shapes flow from Server Components, the `/api/applications` routes
 * and the client hooks unchanged.
 */

/** Raised for expected, user-facing failures (job closed, duplicate apply, …). */
export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "JOB_NOT_FOUND"
      | "JOB_CLOSED"
      | "ALREADY_APPLIED"
      | "NOT_FOUND" = "JOB_NOT_FOUND",
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

// ---------------------------------------------------------------------------
// Reads — duplicate check
// ---------------------------------------------------------------------------

/** True if the candidate has already applied to this job post. */
export async function checkExistingApplication(
  candidateId: string,
  jobPostId: string,
): Promise<boolean> {
  const existing = await prisma.application.findUnique({
    where: { candidateId_jobPostId: { candidateId, jobPostId } },
    select: { id: true },
  });
  return existing !== null;
}

/** The candidate's application id for a job (for "Already applied" links), or null. */
export async function getApplicationIdForJob(
  candidateId: string,
  jobPostId: string,
): Promise<string | null> {
  const existing = await prisma.application.findUnique({
    where: { candidateId_jobPostId: { candidateId, jobPostId } },
    select: { id: true },
  });
  return existing?.id ?? null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create an application for `candidateId` on `jobPostId` with the submitted CV,
 * then fire the in-app notification + confirmation email (best-effort). Profile
 * completeness is enforced upstream in the API route (the service trusts its
 * caller for that policy check).
 */
export async function createApplication(
  candidateId: string,
  jobPostId: string,
  cvUrl: string,
): Promise<ApplicationListItem> {
  const job = await prisma.jobPost.findUnique({
    where: { id: jobPostId },
    select: {
      id: true,
      title: true,
      status: true,
      city: true,
      deadline: true,
      saudiClient: { select: { companyName: true } },
    },
  });

  if (!job) throw new ApplicationError("This job no longer exists.", "JOB_NOT_FOUND");
  if (job.status !== "ACTIVE") {
    throw new ApplicationError("This job is no longer accepting applications.", "JOB_CLOSED");
  }
  if (job.deadline && job.deadline.getTime() < Date.now()) {
    throw new ApplicationError("The application deadline for this job has passed.", "JOB_CLOSED");
  }

  if (await checkExistingApplication(candidateId, jobPostId)) {
    throw new ApplicationError("You have already applied to this job.", "ALREADY_APPLIED");
  }

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { id: true, fullName: true, user: { select: { id: true, email: true } } },
  });
  if (!candidate) throw new ApplicationError("Candidate profile not found.", "NOT_FOUND");

  let application;
  try {
    application = await prisma.application.create({
      data: { candidateId, jobPostId, cvUrl, status: "APPLIED" },
      select: { id: true, status: true, appliedAt: true },
    });
  } catch (error) {
    // Unique (candidate, job) violation — lost a race with a parallel submit.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApplicationError("You have already applied to this job.", "ALREADY_APPLIED");
    }
    throw error;
  }

  // In-app notification (SRS M11) — best-effort, never blocks the application.
  try {
    await prisma.notification.create({
      data: {
        userId: candidate.user.id,
        type: "APPLICATION_RECEIVED",
        title: "Application submitted",
        message: `Your application for ${job.title} at ${job.saudiClient.companyName} has been received.`,
        link: `${ROUTES.CANDIDATE}/applications/${application.id}`,
      },
    });
  } catch (error) {
    console.error("Failed to create application notification", error);
  }

  // Confirmation email (Resend) — best-effort.
  try {
    const detailUrl = new URL(
      `${ROUTES.CANDIDATE}/applications/${application.id}`,
      clientEnv.NEXT_PUBLIC_APP_URL,
    ).toString();
    const template = applicationReceivedEmail({
      candidateName: candidate.fullName,
      jobTitle: job.title,
      companyName: job.saudiClient.companyName,
      applicationUrl: detailUrl,
    });
    await resend.emails.send({
      from: EMAIL_FROM,
      to: candidate.user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.error("Failed to send application confirmation email", error);
  }

  return {
    id: application.id,
    jobPostId,
    jobTitle: job.title,
    companyName: job.saudiClient.companyName,
    city: job.city,
    status: application.status,
    tier: null,
    appliedAt: application.appliedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Reads — list
// ---------------------------------------------------------------------------

function toTier(tier: CandidateTier | null | undefined): CandidateTier | null {
  return tier && tier !== "PENDING" ? tier : null;
}

/** All of a candidate's applications, newest first, for the "My Applications" list. */
export async function getApplicationsByCandidate(
  candidateId: string,
): Promise<ApplicationListItem[]> {
  const applications = await prisma.application.findMany({
    where: { candidateId },
    orderBy: { appliedAt: "desc" },
    select: {
      id: true,
      jobPostId: true,
      status: true,
      appliedAt: true,
      jobPost: {
        select: {
          title: true,
          city: true,
          saudiClient: { select: { companyName: true } },
        },
      },
      tierRecord: { select: { tier: true } },
    },
  });

  return applications.map((a) => ({
    id: a.id,
    jobPostId: a.jobPostId,
    jobTitle: a.jobPost.title,
    companyName: a.jobPost.saudiClient.companyName,
    city: a.jobPost.city,
    status: a.status,
    tier: toTier(a.tierRecord?.tier),
    appliedAt: a.appliedAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Reads — detail (with timeline)
// ---------------------------------------------------------------------------

/** Ordered pipeline steps the candidate sees on the application timeline. */
const TIMELINE_STEPS = [
  { key: "applied", title: "Application submitted" },
  { key: "assessment", title: "Trade assessment" },
  { key: "interview", title: "AI interview" },
  { key: "shortlist", title: "Tiering & shortlisting" },
  { key: "selection", title: "Selection" },
  { key: "deployment", title: "Deployment" },
] as const;

/** Which timeline step a given application status has reached (1-based). */
const STATUS_STEP: Record<ApplicationStatus, number> = {
  APPLIED: 1,
  ASSESSMENT_PENDING: 2,
  ASSESSMENT_PASSED: 2,
  ASSESSMENT_FAILED: 2,
  INTERVIEW_INVITED: 3,
  INTERVIEW_IN_PROGRESS: 3,
  INTERVIEW_COMPLETED: 3,
  TIERED: 4,
  IN_CLIENT_POOL: 4,
  CLIENT_SHORTLISTED: 4,
  LIVE_INTERVIEW_SCHEDULED: 4,
  SELECTED: 5,
  POST_SELECTION: 6,
  DEPLOYED: 6,
  REJECTED: 0,
  WITHDRAWN: 0,
};

const postSelectionInclude = {
  jobPost: { select: { title: true, sector: true, city: true, country: true, saudiClient: { select: { companyName: true } } } },
  assessmentAttempt: { select: { score: true, passed: true, submittedAt: true } },
  aiInterviewAttempt: {
    select: { overallInterviewScore: true, aiSummary: true, completedAt: true },
  },
  tierRecord: { select: { tier: true, finalScore: true, assignedAt: true } },
  postSelectionRecord: true,
} satisfies Prisma.ApplicationInclude;

type ApplicationDetailRow = Prisma.ApplicationGetPayload<{
  include: typeof postSelectionInclude;
}>;

/** Build the candidate-facing history timeline from the application's records. */
function buildTimeline(app: ApplicationDetailRow): ApplicationTimelineItem[] {
  const reached = STATUS_STEP[app.status];
  const isTerminalReject = app.status === "REJECTED" || app.status === "WITHDRAWN";

  // Per-step completion date where we have a concrete record.
  const dates: Record<string, string | null> = {
    applied: app.appliedAt.toISOString(),
    assessment: app.assessmentAttempt?.submittedAt?.toISOString() ?? null,
    interview: app.aiInterviewAttempt?.completedAt?.toISOString() ?? null,
    shortlist: app.tierRecord?.assignedAt?.toISOString() ?? null,
    selection: app.status === "SELECTED" || reached >= 5 ? app.updatedAt.toISOString() : null,
    deployment: reached >= 6 ? app.updatedAt.toISOString() : null,
  };

  const descriptions: Record<string, string | null> = {
    applied: null,
    assessment:
      app.assessmentAttempt?.submittedAt != null
        ? app.assessmentAttempt.passed
          ? `Passed with ${Math.round(app.assessmentAttempt.score ?? 0)}%`
          : `Scored ${Math.round(app.assessmentAttempt.score ?? 0)}%`
        : null,
    interview:
      app.aiInterviewAttempt?.completedAt != null
        ? `Overall score ${Math.round(app.aiInterviewAttempt.overallInterviewScore ?? 0)}%`
        : null,
    shortlist:
      app.tierRecord && app.tierRecord.tier !== "PENDING"
        ? `Tier assigned: ${app.tierRecord.tier}`
        : null,
    selection: null,
    deployment: null,
  };

  return TIMELINE_STEPS.map((step, index) => {
    const stepNumber = index + 1;
    let state: ApplicationTimelineItem["state"];
    if (isTerminalReject) {
      state = stepNumber === 1 ? "done" : "upcoming";
    } else if (stepNumber < reached) {
      state = "done";
    } else if (stepNumber === reached) {
      state = "current";
    } else {
      state = "upcoming";
    }

    return {
      id: step.key,
      title: step.title,
      description: descriptions[step.key],
      date: dates[step.key],
      state,
    };
  });
}

/** Build the post-selection deployment tracker from the record (or null). */
function buildPostSelection(
  record: ApplicationDetailRow["postSelectionRecord"],
): ApplicationPostSelection | null {
  if (!record) return null;

  const doneByStage: Record<string, { done: boolean; status: string | null }> = {
    [POST_SELECTION_STAGES.OFFER_LETTER]: {
      status: record.offerLetterStatus,
      done: record.offerLetterStatus === "ACCEPTED" || record.offerLetterStatus === "SENT",
    },
    [POST_SELECTION_STAGES.GAMCA_MEDICAL]: {
      status: record.gamcaStatus,
      done: record.gamcaStatus === "FIT",
    },
    [POST_SELECTION_STAGES.VISA_APPLICATION]: {
      status: record.visaStatus,
      done: record.visaStatus === "STAMPED",
    },
    [POST_SELECTION_STAGES.FLIGHT_TICKET]: {
      status: record.ticketArrangement,
      done: record.ticketArrangement === "ISSUED",
    },
    [POST_SELECTION_STAGES.PRE_DEPARTURE_BRIEF]: {
      status: record.preDepartureBriefStatus,
      done: record.preDepartureBriefStatus === "COMPLETED",
    },
    [POST_SELECTION_STAGES.DEPARTURE]: {
      status: record.actualDepartureDate ? "DEPARTED" : "PENDING",
      done: record.actualDepartureDate !== null,
    },
    [POST_SELECTION_STAGES.ARRIVAL_IN_KSA]: {
      status: record.arrivalStatus,
      done: record.arrivalStatus === "ARRIVED" || record.arrivalStatus === "CONFIRMED",
    },
    [POST_SELECTION_STAGES.PROBATION_STATUS]: {
      status: record.probationStatus,
      done: record.probationStatus === "PASSED",
    },
  };

  const milestones: ApplicationPostSelectionMilestone[] = POST_SELECTION_STAGE_ORDER.map(
    (stage) => ({
      stage,
      label: POST_SELECTION_STAGE_LABELS[stage],
      status: doneByStage[stage]?.status ?? null,
      done: doneByStage[stage]?.done ?? false,
    }),
  );

  const doneCount = milestones.filter((m) => m.done).length;
  return {
    milestones,
    progress: Math.round((doneCount / milestones.length) * 100),
  };
}

/**
 * Full detail for one of the candidate's applications, scoped to its owner.
 * Returns `null` if the application doesn't exist or belongs to someone else.
 */
export async function getApplicationDetail(
  applicationId: string,
  candidateId: string,
): Promise<ApplicationDetailDTO | null> {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, candidateId },
    include: postSelectionInclude,
  });
  if (!app) return null;

  const assessment = app.assessmentAttempt
    ? {
        score: app.assessmentAttempt.score,
        passed: app.assessmentAttempt.passed,
        submittedAt: app.assessmentAttempt.submittedAt?.toISOString() ?? null,
      }
    : null;

  const interview = app.aiInterviewAttempt
    ? {
        overallScore: app.aiInterviewAttempt.overallInterviewScore,
        tier: toTier(app.tierRecord?.tier),
        aiSummary: app.aiInterviewAttempt.aiSummary,
        completedAt: app.aiInterviewAttempt.completedAt?.toISOString() ?? null,
      }
    : null;

  return {
    id: app.id,
    jobPostId: app.jobPostId,
    jobTitle: app.jobPost.title,
    companyName: app.jobPost.saudiClient.companyName,
    sector: app.jobPost.sector,
    city: app.jobPost.city,
    country: app.jobPost.country,
    status: app.status,
    cvUrl: app.cvUrl,
    tier: toTier(app.tierRecord?.tier),
    finalScore: app.tierRecord?.finalScore ?? null,
    appliedAt: app.appliedAt.toISOString(),
    assessment,
    interview,
    postSelection: buildPostSelection(app.postSelectionRecord),
    timeline: buildTimeline(app),
  };
}

/** Status labels re-exported for convenience (timeline/badge copy). */
export { APPLICATION_STATUS_LABELS };
