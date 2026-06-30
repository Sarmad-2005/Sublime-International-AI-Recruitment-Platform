import "server-only";

import { randomUUID } from "node:crypto";

import { prisma, Prisma } from "@/lib/prisma";
import {
  AI_INTERVIEW_BASE_PATH,
  AI_INTERVIEW_INVITE_TTL_HOURS,
  ASSESSMENT_DEFAULTS,
  ASSESSMENT_TAB_SWITCH_LIMIT,
  QUESTION_TYPE_LABELS,
  ROUTES,
} from "@/lib/constants";
import {
  resend,
  EMAIL_FROM,
  assessmentResultEmail,
  aiInterviewInviteEmail,
} from "@/lib/email";
import { clientEnv } from "@/lib/env";
import type { QuestionType } from "@/generated/prisma/enums";
import type {
  AssessmentCategoryBreakdown,
  AssessmentConfigDTO,
  AssessmentEntryDTO,
  AssessmentEntryState,
  AssessmentOptionDTO,
  AssessmentQuestionDTO,
  AssessmentResultDTO,
  AssessmentTakeDTO,
  RetakeStatus,
  StartAttemptResult,
  TabSwitchResult,
} from "@/types";
import type { AssessmentAnswers } from "@/lib/validations";

/**
 * Trade-assessment service (SRS M4) — the only layer that reads/writes
 * assessments, attempts and the resulting pipeline transitions (Rule #5).
 * Returns JSON-safe DTOs (dates as ISO strings) and never leaks the correct
 * answers to the candidate-facing shapes; scoring is server-side only.
 */

/** Raised for expected, user-facing failures (ineligible, already passed, …). */
export class AssessmentError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "NOT_CONFIGURED"
      | "NO_CV"
      | "ALREADY_PASSED"
      | "RETAKE_LOCKED"
      | "ALREADY_ADVANCED"
      | "NO_ACTIVE_ATTEMPT"
      | "ALREADY_SUBMITTED" = "NOT_FOUND",
  ) {
    super(message);
    this.name = "AssessmentError";
  }
}

// ---------------------------------------------------------------------------
// JSON parsing — `options` / `correctAnswers` are stored as opaque JSON.
// ---------------------------------------------------------------------------

interface RawOption {
  id: string;
  text: string;
  imageUrl: string | null;
}

function parseOptions(value: Prisma.JsonValue): RawOption[] {
  if (!Array.isArray(value)) return [];
  const out: RawOption[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const id = record.id;
      const text = record.text;
      if (typeof id === "string" && typeof text === "string") {
        out.push({
          id,
          text,
          imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
        });
      }
    }
  }
  return out;
}

function parseStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

// ---------------------------------------------------------------------------
// Randomisation (Fisher–Yates) — applied per request, not persisted. Answers
// are keyed by stable option ids, so shuffling never affects scoring.
// ---------------------------------------------------------------------------

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

type AssessmentRow = Prisma.TradeAssessmentGetPayload<{
  include: { questions: true };
}>;

function toConfigDTO(a: {
  id: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  passingScore: number;
  totalQuestions: number;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  allowRetake: boolean;
  retakeCooldownDays: number;
}): AssessmentConfigDTO {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    timeLimitMinutes: a.timeLimitMinutes,
    passingScore: a.passingScore,
    totalQuestions: a.totalQuestions,
    allowPrevious: ASSESSMENT_DEFAULTS.allowPrevious,
    autoAdvance: ASSESSMENT_DEFAULTS.autoAdvance,
    randomizeQuestions: a.randomizeQuestions,
    randomizeAnswers: a.randomizeAnswers,
    allowRetake: a.allowRetake,
    retakeCooldownDays: a.retakeCooldownDays,
  };
}

/** Strip correct answers and (optionally) shuffle a question for the browser. */
function toCandidateQuestion(
  question: AssessmentRow["questions"][number],
  shuffleAnswers: boolean,
): AssessmentQuestionDTO {
  const options = parseOptions(question.options);
  const ordered = shuffleAnswers ? shuffled(options) : options;
  const safeOptions: AssessmentOptionDTO[] = ordered.map((o) => ({
    id: o.id,
    text: o.text,
    imageUrl: o.imageUrl,
  }));
  return {
    id: question.id,
    type: question.type,
    questionText: question.questionText,
    imageUrl: question.imageUrl,
    points: question.points,
    options: safeOptions,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Whether a single question's selected option ids are fully correct. */
function isCorrect(
  type: QuestionType,
  correct: string[],
  selected: string[],
): boolean {
  const correctSet = new Set(correct);
  const selectedSet = new Set(selected);
  if (type === "MULTI_SELECT") {
    return (
      correctSet.size === selectedSet.size &&
      [...correctSet].every((id) => selectedSet.has(id))
    );
  }
  // Single-answer types (MCQ / SCENARIO / IMAGE_BASED): exactly one pick.
  return selectedSet.size === 1 && correctSet.has([...selectedSet][0]!);
}

interface ScoreBreakdown {
  /** 0–100, rounded. */
  score: number;
  correctCount: number;
  totalQuestions: number;
  categories: AssessmentCategoryBreakdown[];
}

/** Pure scorer — deterministic from the question bank and the responses. */
function computeScore(
  questions: AssessmentRow["questions"],
  answers: AssessmentAnswers,
): ScoreBreakdown {
  let earnedPoints = 0;
  let totalPoints = 0;
  let correctCount = 0;

  const byType = new Map<QuestionType, { correct: number; total: number }>();

  for (const q of questions) {
    totalPoints += q.points;
    const correctAnswers = parseStringArray(q.correctAnswers);
    const selected = answers[q.id] ?? [];
    const ok = isCorrect(q.type, correctAnswers, selected);

    if (ok) {
      earnedPoints += q.points;
      correctCount += 1;
    }

    const bucket = byType.get(q.type) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (ok) bucket.correct += 1;
    byType.set(q.type, bucket);
  }

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  const categories: AssessmentCategoryBreakdown[] = [...byType.entries()].map(
    ([category, { correct, total }]) => ({
      category,
      label: QUESTION_TYPE_LABELS[category] ?? category,
      correct,
      total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
    }),
  );

  return { score, correctCount, totalQuestions: questions.length, categories };
}

// ---------------------------------------------------------------------------
// Retake eligibility
// ---------------------------------------------------------------------------

function buildRetakeStatus(
  allowRetake: boolean,
  cooldownDays: number,
  lastSubmittedAt: Date | null,
): RetakeStatus {
  if (!allowRetake) {
    return { allowed: false, eligible: false, availableAt: null, cooldownDays };
  }
  if (!lastSubmittedAt || cooldownDays <= 0) {
    return { allowed: true, eligible: true, availableAt: null, cooldownDays };
  }
  const availableAt = new Date(
    lastSubmittedAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000,
  );
  const eligible = availableAt.getTime() <= Date.now();
  return {
    allowed: true,
    eligible,
    availableAt: eligible ? null : availableAt.toISOString(),
    cooldownDays,
  };
}

/** Public retake check (SRS M4) — used by the entry screen and the start guard. */
export async function checkRetakeEligibility(
  applicationId: string,
): Promise<RetakeStatus> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      assessmentAttempt: { select: { submittedAt: true, passed: true } },
      jobPost: {
        select: {
          tradeAssessment: {
            select: { allowRetake: true, retakeCooldownDays: true },
          },
        },
      },
    },
  });

  const assessment = application?.jobPost.tradeAssessment;
  if (!assessment) {
    return { allowed: false, eligible: false, availableAt: null, cooldownDays: 0 };
  }

  return buildRetakeStatus(
    assessment.allowRetake,
    assessment.retakeCooldownDays,
    application?.assessmentAttempt?.submittedAt ?? null,
  );
}

// ---------------------------------------------------------------------------
// Shared loader — application + assessment + attempt, scoped to the candidate.
// ---------------------------------------------------------------------------

const applicationInclude = {
  jobPost: {
    select: {
      title: true,
      saudiClient: { select: { companyName: true } },
      tradeAssessment: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
    },
  },
  assessmentAttempt: true,
} satisfies Prisma.ApplicationInclude;

type ApplicationContext = Prisma.ApplicationGetPayload<{
  include: typeof applicationInclude;
}>;

async function loadContext(
  applicationId: string,
  candidateId: string,
): Promise<ApplicationContext | null> {
  return prisma.application.findFirst({
    where: { id: applicationId, candidateId },
    include: applicationInclude,
  });
}

// ---------------------------------------------------------------------------
// Entry screen
// ---------------------------------------------------------------------------

/** Statuses for which the candidate has already moved past Stage 1. */
const PAST_ASSESSMENT_STATUSES = new Set([
  "INTERVIEW_INVITED",
  "INTERVIEW_IN_PROGRESS",
  "INTERVIEW_COMPLETED",
  "TIERED",
  "IN_CLIENT_POOL",
  "CLIENT_SHORTLISTED",
  "LIVE_INTERVIEW_SCHEDULED",
  "SELECTED",
  "POST_SELECTION",
  "DEPLOYED",
]);

/**
 * Everything the entry / instructions page needs to branch on. Returns `null`
 * only when the application doesn't exist or isn't the candidate's.
 */
export async function getAssessmentEntry(
  applicationId: string,
  candidateId: string,
): Promise<AssessmentEntryDTO | null> {
  const ctx = await loadContext(applicationId, candidateId);
  if (!ctx) return null;

  const assessment = ctx.jobPost.tradeAssessment;
  const base = {
    applicationId,
    jobTitle: ctx.jobPost.title,
    companyName: ctx.jobPost.saudiClient.companyName,
  };

  if (!assessment || !assessment.isActive) {
    return { ...base, state: "NOT_CONFIGURED", config: null, attempt: null, retake: null };
  }

  const config = toConfigDTO(assessment);
  const attempt = ctx.assessmentAttempt;
  const attemptSummary = attempt
    ? {
        id: attempt.id,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        score: attempt.score,
        passed: attempt.passed,
        flaggedSuspicious: attempt.flaggedSuspicious,
      }
    : null;

  // An in-progress (started, not submitted) attempt → resume.
  if (attempt && !attempt.submittedAt) {
    return { ...base, state: "IN_PROGRESS", config, attempt: attemptSummary, retake: null };
  }

  // Passed — either recorded on the attempt or implied by an advanced status.
  if (attempt?.passed) {
    return { ...base, state: "PASSED", config, attempt: attemptSummary, retake: null };
  }
  if (PAST_ASSESSMENT_STATUSES.has(ctx.status)) {
    return { ...base, state: "ALREADY_ADVANCED", config, attempt: attemptSummary, retake: null };
  }

  // Submitted and failed — surface retake availability.
  if (attempt?.submittedAt) {
    const retake = buildRetakeStatus(
      assessment.allowRetake,
      assessment.retakeCooldownDays,
      attempt.submittedAt,
    );
    const state: AssessmentEntryState = !retake.allowed
      ? "FAILED_FINAL"
      : retake.eligible
        ? "FAILED_RETAKE"
        : "FAILED_COOLDOWN";
    return { ...base, state, config, attempt: attemptSummary, retake };
  }

  // No attempt yet — must have submitted a CV to be eligible.
  if (!ctx.cvUrl) {
    return { ...base, state: "NO_CV", config, attempt: null, retake: null };
  }

  return { ...base, state: "ELIGIBLE", config, attempt: null, retake: null };
}

// ---------------------------------------------------------------------------
// Questions (GET) — candidate-safe, randomised per config.
// ---------------------------------------------------------------------------

/**
 * The assessment config + candidate-safe questions for an application, plus the
 * current attempt's live state. `null` if the application isn't the candidate's
 * or has no active assessment. Throws if there is no in-progress attempt.
 */
export async function getAssessmentForApplication(
  applicationId: string,
  candidateId: string,
): Promise<AssessmentTakeDTO | null> {
  const ctx = await loadContext(applicationId, candidateId);
  if (!ctx) return null;

  const assessment = ctx.jobPost.tradeAssessment;
  if (!assessment || !assessment.isActive) return null;

  const attempt = ctx.assessmentAttempt;
  if (!attempt || attempt.submittedAt) {
    throw new AssessmentError(
      "Start the assessment before loading its questions.",
      "NO_ACTIVE_ATTEMPT",
    );
  }

  return buildTakePayload(assessment, attempt.id, attempt.startedAt, attempt.tabSwitchCount);
}

function buildTakePayload(
  assessment: AssessmentRow,
  attemptId: string,
  startedAt: Date,
  tabSwitchCount: number,
): AssessmentTakeDTO {
  const config = toConfigDTO(assessment);
  const ordered = assessment.randomizeQuestions
    ? shuffled(assessment.questions)
    : assessment.questions;
  const questions = ordered.map((q) =>
    toCandidateQuestion(q, assessment.randomizeAnswers),
  );
  const endsAt = new Date(
    startedAt.getTime() + assessment.timeLimitMinutes * 60 * 1000,
  );
  return {
    attemptId,
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    config,
    questions,
    tabSwitchCount,
  };
}

// ---------------------------------------------------------------------------
// Start an attempt (create or reset on an allowed retake)
// ---------------------------------------------------------------------------

/**
 * Begin (or resume) an attempt for the candidate's application. Creates the
 * attempt row on a first try, resumes an in-progress one, or resets a failed
 * one when a retake is allowed and unlocked. Throws `AssessmentError` otherwise.
 */
export async function startAttempt(
  applicationId: string,
  candidateId: string,
): Promise<StartAttemptResult> {
  const ctx = await loadContext(applicationId, candidateId);
  if (!ctx) throw new AssessmentError("Application not found.", "NOT_FOUND");

  const assessment = ctx.jobPost.tradeAssessment;
  if (!assessment || !assessment.isActive) {
    throw new AssessmentError(
      "No assessment is configured for this job.",
      "NOT_CONFIGURED",
    );
  }
  if (PAST_ASSESSMENT_STATUSES.has(ctx.status)) {
    throw new AssessmentError(
      "This application has already moved past the assessment stage.",
      "ALREADY_ADVANCED",
    );
  }
  if (!ctx.cvUrl) {
    throw new AssessmentError(
      "Submit your CV for this job before taking the assessment.",
      "NO_CV",
    );
  }

  const existing = ctx.assessmentAttempt;
  const now = new Date();
  const toResult = (attempt: { id: string; startedAt: Date }): StartAttemptResult => ({
    attemptId: attempt.id,
    startedAt: attempt.startedAt.toISOString(),
    endsAt: new Date(
      attempt.startedAt.getTime() + assessment.timeLimitMinutes * 60 * 1000,
    ).toISOString(),
  });

  // Resume an unfinished attempt.
  if (existing && !existing.submittedAt) {
    return toResult(existing);
  }

  if (existing?.passed) {
    throw new AssessmentError("You have already passed this assessment.", "ALREADY_PASSED");
  }

  // A previously-submitted (failed) attempt — gate on retake eligibility.
  if (existing?.submittedAt) {
    const retake = buildRetakeStatus(
      assessment.allowRetake,
      assessment.retakeCooldownDays,
      existing.submittedAt,
    );
    if (!retake.eligible) {
      throw new AssessmentError(
        retake.allowed
          ? "This assessment can't be retaken yet."
          : "Retakes are not allowed for this assessment.",
        "RETAKE_LOCKED",
      );
    }
    const reset = await prisma.assessmentAttempt.update({
      where: { id: existing.id },
      data: {
        startedAt: now,
        submittedAt: null,
        score: null,
        passed: false,
        answers: Prisma.DbNull,
        flaggedSuspicious: false,
        tabSwitchCount: 0,
      },
      select: { id: true, startedAt: true },
    });
    return toResult(reset);
  }

  // First attempt — create the row. Also move the application into the
  // assessment stage if it's still freshly applied.
  const created = await prisma.assessmentAttempt.create({
    data: {
      applicationId,
      candidateId,
      assessmentId: assessment.id,
      startedAt: now,
    },
    select: { id: true, startedAt: true },
  });

  if (ctx.status === "APPLIED") {
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "ASSESSMENT_PENDING" },
    });
  }

  return toResult(created);
}

// ---------------------------------------------------------------------------
// Tab-switch logging (anti-cheating)
// ---------------------------------------------------------------------------

/**
 * Record a tab/visibility switch on the candidate's in-progress attempt and
 * return the running count. The route auto-submits once the count reaches
 * `ASSESSMENT_TAB_SWITCH_LIMIT`.
 */
export async function logTabSwitch(
  applicationId: string,
  candidateId: string,
): Promise<TabSwitchResult> {
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { applicationId, candidateId, submittedAt: null },
    select: { id: true },
  });
  if (!attempt) {
    throw new AssessmentError("No active attempt to log against.", "NO_ACTIVE_ATTEMPT");
  }

  const updated = await prisma.assessmentAttempt.update({
    where: { id: attempt.id },
    data: { tabSwitchCount: { increment: 1 } },
    select: { tabSwitchCount: true },
  });

  return {
    count: updated.tabSwitchCount,
    autoSubmit: updated.tabSwitchCount >= ASSESSMENT_TAB_SWITCH_LIMIT,
  };
}

// ---------------------------------------------------------------------------
// Submit & score
// ---------------------------------------------------------------------------

/** The active (unsubmitted) attempt id for an application, scoped to its owner. */
export async function getActiveAttemptId(
  applicationId: string,
  candidateId: string,
): Promise<string | null> {
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { applicationId, candidateId, submittedAt: null },
    select: { id: true },
  });
  return attempt?.id ?? null;
}

/**
 * Score a submitted attempt, persist the result, advance the pipeline, and —
 * on a pass — fire the AI-interview invite (attempt record + email + notice).
 * Returns the candidate-facing result. Throws if already submitted.
 */
export async function scoreAttempt(
  attemptId: string,
  answers: AssessmentAnswers,
  flaggedSuspicious = false,
): Promise<AssessmentResultDTO> {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      assessment: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
      application: {
        select: {
          id: true,
          status: true,
          jobPost: {
            select: { title: true, saudiClient: { select: { companyName: true } } },
          },
        },
      },
      candidate: {
        select: { id: true, fullName: true, user: { select: { id: true, email: true } } },
      },
    },
  });

  if (!attempt) throw new AssessmentError("Attempt not found.", "NOT_FOUND");
  if (attempt.submittedAt) {
    throw new AssessmentError("This attempt has already been submitted.", "ALREADY_SUBMITTED");
  }

  const { assessment, application, candidate } = attempt;
  const breakdown = computeScore(assessment.questions, answers);
  const passed = breakdown.score >= assessment.passingScore;
  const submittedAt = new Date();

  // Persist the attempt result and advance the application status atomically.
  // On a pass we jump straight to INTERVIEW_INVITED (Stage 2 entry).
  await prisma.$transaction(async (tx) => {
    await tx.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt,
        score: breakdown.score,
        passed,
        answers: answers as Prisma.InputJsonValue,
        flaggedSuspicious: flaggedSuspicious || attempt.flaggedSuspicious,
      },
    });
    await tx.application.update({
      where: { id: application.id },
      data: { status: passed ? "INTERVIEW_INVITED" : "ASSESSMENT_FAILED" },
    });
  });

  const result: AssessmentResultDTO = {
    applicationId: application.id,
    jobTitle: application.jobPost.title,
    companyName: application.jobPost.saudiClient.companyName,
    score: breakdown.score,
    passed,
    passingScore: assessment.passingScore,
    submittedAt: submittedAt.toISOString(),
    flaggedSuspicious: flaggedSuspicious || attempt.flaggedSuspicious,
    totalQuestions: breakdown.totalQuestions,
    correctCount: breakdown.correctCount,
    categories: breakdown.categories,
    retake: passed
      ? null
      : buildRetakeStatus(
          assessment.allowRetake,
          assessment.retakeCooldownDays,
          submittedAt,
        ),
  };

  // Result email (best-effort, but awaited so it isn't dropped on a serverless
  // freeze — the send is internally wrapped in try/catch and never throws).
  await sendResultEmail({
    email: candidate.user.email,
    candidateName: candidate.fullName,
    jobTitle: result.jobTitle,
    companyName: result.companyName,
    passed,
    score: result.score,
    passingScore: result.passingScore,
    applicationId: application.id,
  });

  // On a pass, provision the AI interview (Stage 2) — best-effort beyond the DB.
  if (passed) {
    await provisionAiInterview({
      applicationId: application.id,
      candidateId: candidate.id,
      userId: candidate.user.id,
      candidateName: candidate.fullName,
      email: candidate.user.email,
      jobTitle: result.jobTitle,
      companyName: result.companyName,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Result screen
// ---------------------------------------------------------------------------

/**
 * The scored result for the candidate's submitted attempt (recomputed from the
 * stored answers, so the breakdown is always consistent). `null` if there is no
 * submitted attempt for this application.
 */
export async function getAttemptResult(
  applicationId: string,
  candidateId: string,
): Promise<AssessmentResultDTO | null> {
  const ctx = await loadContext(applicationId, candidateId);
  if (!ctx) return null;

  const assessment = ctx.jobPost.tradeAssessment;
  const attempt = ctx.assessmentAttempt;
  if (!assessment || !attempt || !attempt.submittedAt) return null;

  const answers = (attempt.answers ?? {}) as AssessmentAnswers;
  const breakdown = computeScore(assessment.questions, answers);
  const score = attempt.score ?? breakdown.score;
  const passed = attempt.passed;

  return {
    applicationId,
    jobTitle: ctx.jobPost.title,
    companyName: ctx.jobPost.saudiClient.companyName,
    score,
    passed,
    passingScore: assessment.passingScore,
    submittedAt: attempt.submittedAt.toISOString(),
    flaggedSuspicious: attempt.flaggedSuspicious,
    totalQuestions: breakdown.totalQuestions,
    correctCount: breakdown.correctCount,
    categories: breakdown.categories,
    retake: passed
      ? null
      : buildRetakeStatus(
          assessment.allowRetake,
          assessment.retakeCooldownDays,
          attempt.submittedAt,
        ),
  };
}

// ---------------------------------------------------------------------------
// Post-pass automation
// ---------------------------------------------------------------------------

function absoluteUrl(path: string): string {
  return new URL(path, clientEnv.NEXT_PUBLIC_APP_URL).toString();
}

interface ResultEmailArgs {
  email: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  passed: boolean;
  score: number;
  passingScore: number;
  applicationId: string;
}

async function sendResultEmail(args: ResultEmailArgs): Promise<void> {
  try {
    const template = assessmentResultEmail({
      candidateName: args.candidateName,
      jobTitle: args.jobTitle,
      companyName: args.companyName,
      passed: args.passed,
      score: args.score,
      passingScore: args.passingScore,
      resultUrl: absoluteUrl(`/assessment/${args.applicationId}/result`),
    });
    await resend.emails.send({
      from: EMAIL_FROM,
      to: args.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.error("Failed to send assessment result email", error);
  }
}

interface ProvisionArgs {
  applicationId: string;
  candidateId: string;
  userId: string;
  candidateName: string;
  email: string;
  jobTitle: string;
  companyName: string;
}

/**
 * Create the AI-interview attempt (status INVITED, one-time token, 72h expiry)
 * and notify the candidate. The DB record is the source of truth; the email and
 * in-app notification are best-effort.
 */
async function provisionAiInterview(args: ProvisionArgs): Promise<void> {
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + AI_INTERVIEW_INVITE_TTL_HOURS * 60 * 60 * 1000,
  );

  // Idempotent on applicationId (unique) — a double submit won't duplicate.
  let interview;
  try {
    interview = await prisma.aIInterviewAttempt.upsert({
      where: { applicationId: args.applicationId },
      create: {
        applicationId: args.applicationId,
        candidateId: args.candidateId,
        status: "INVITED",
        invitedAt: now,
        inviteLinkToken: token,
        inviteLinkExpiresAt: expiresAt,
      },
      update: {},
      select: { inviteLinkToken: true, inviteLinkExpiresAt: true },
    });
  } catch (error) {
    console.error("Failed to create AI interview attempt", error);
    return;
  }

  const interviewUrl = absoluteUrl(
    `${AI_INTERVIEW_BASE_PATH}/${interview.inviteLinkToken}`,
  );
  const expiresAtLabel = (interview.inviteLinkExpiresAt ?? expiresAt).toUTCString();

  try {
    const template = aiInterviewInviteEmail({
      candidateName: args.candidateName,
      jobTitle: args.jobTitle,
      companyName: args.companyName,
      interviewUrl,
      expiresAtLabel,
    });
    await resend.emails.send({
      from: EMAIL_FROM,
      to: args.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.error("Failed to send AI interview invite email", error);
  }

  try {
    await prisma.notification.create({
      data: {
        userId: args.userId,
        type: "AI_INTERVIEW_INVITE",
        title: "AI interview invitation",
        message: `You've advanced to the AI interview for ${args.jobTitle} at ${args.companyName}.`,
        link: `${ROUTES.CANDIDATE}/applications/${args.applicationId}`,
      },
    });
  } catch (error) {
    console.error("Failed to create AI interview notification", error);
  }
}
