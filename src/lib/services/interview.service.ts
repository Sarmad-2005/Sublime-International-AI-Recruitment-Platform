import "server-only";

import { z } from "zod";

import { prisma, Prisma } from "@/lib/prisma";
import {
  AI_INTERVIEW_QUESTION_TIME_LIMIT_SECONDS,
  CANDIDATE_TIER_LABELS,
  DEFAULT_AI_INTERVIEW_QUESTIONS,
  ROUTES,
  type InterviewRecommendation,
} from "@/lib/constants";
import { runAi, type AiDebugEntry } from "@/lib/ai";
import { sendEmail, interviewTierResultEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/utils/url";
import type { AIInterviewStatus } from "@/generated/prisma/enums";
import {
  finalizeRecording as finalizeStorageRecording,
  uploadIdentitySnapshot,
  uploadRecordingChunk as uploadStorageChunk,
} from "@/lib/storage/interview-recordings";
import {
  calculateFinalScore,
  assignTier,
  createTierRecord,
  updateApplicationStage,
} from "./tier.service";
import type { DeviceCheckInput, InterviewTranscriptEntry } from "@/lib/validations";
import type {
  InterviewEntryDTO,
  InterviewQuestionDTO,
  InterviewScoreResult,
  InterviewScores,
  InterviewSessionDTO,
  InterviewTokenState,
  TierRecordDTO,
} from "@/types";

/**
 * AI-interview service (SRS M5) — the only layer that reads/writes interview
 * attempts and drives the post-interview tiering. Token-scoped (no auth beyond
 * the one-time invite token) and JSON-safe. Gemini is the interviewer (live
 * follow-ups) and the evaluator (scoring); every Gemini call is captured in a
 * debug log on the attempt for troubleshooting.
 *
 * Schema note: the `AIInterviewAttempt.responses` JSON column carries the
 * interview-specific state that has no dedicated columns — identity snapshot,
 * consent, device check, transcript, the qualitative scoring extras
 * (strengths / improvements / recommendation) and the Gemini debug log. The
 * scored sub-scores, `aiSummary` and `recordingUrl` use their real columns.
 */

export class InterviewError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "EXPIRED"
      | "ALREADY_COMPLETED"
      | "NOT_STARTED"
      | "CONSENT_REQUIRED"
      | "SCORING_FAILED" = "NOT_FOUND",
  ) {
    super(message);
    this.name = "InterviewError";
  }
}

/** Map an `InterviewError` code to an HTTP status (shared by the routes). */
export function statusForInterviewError(code: InterviewError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "EXPIRED":
      return 410;
    case "ALREADY_COMPLETED":
    case "NOT_STARTED":
      return 409;
    case "CONSENT_REQUIRED":
      return 400;
    case "SCORING_FAILED":
      return 502;
    default:
      return 400;
  }
}

// ---------------------------------------------------------------------------
// `responses` JSON blob — read/merge helpers.
// ---------------------------------------------------------------------------

interface RecordingMeta {
  chunkCount: number;
  /** Storage object path of the stitched recording (null until finalized). */
  path: string | null;
  finalizedAt: string | null;
}

interface InterviewBlob {
  identityPhotoUrl: string | null;
  consentGivenAt: string | null;
  deviceCheck: DeviceCheckInput | null;
  recording: RecordingMeta;
  transcript: InterviewTranscriptEntry[];
  scoring: {
    strengths: string[];
    improvements: string[];
    recommendation: InterviewRecommendation;
  } | null;
  debug: AiDebugEntry[];
}

const MAX_DEBUG_ENTRIES = 20;

function emptyBlob(): InterviewBlob {
  return {
    identityPhotoUrl: null,
    consentGivenAt: null,
    deviceCheck: null,
    recording: { chunkCount: 0, path: null, finalizedAt: null },
    transcript: [],
    scoring: null,
    debug: [],
  };
}

function readBlob(value: Prisma.JsonValue | null): InterviewBlob {
  const base = emptyBlob();
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const v = value as Record<string, unknown>;
  return {
    identityPhotoUrl:
      typeof v.identityPhotoUrl === "string" ? v.identityPhotoUrl : null,
    consentGivenAt: typeof v.consentGivenAt === "string" ? v.consentGivenAt : null,
    deviceCheck: (v.deviceCheck as DeviceCheckInput | null) ?? null,
    recording: {
      chunkCount:
        typeof (v.recording as RecordingMeta | undefined)?.chunkCount === "number"
          ? (v.recording as RecordingMeta).chunkCount
          : 0,
      path: (v.recording as RecordingMeta | undefined)?.path ?? null,
      finalizedAt: (v.recording as RecordingMeta | undefined)?.finalizedAt ?? null,
    },
    transcript: Array.isArray(v.transcript)
      ? (v.transcript as InterviewTranscriptEntry[])
      : [],
    scoring: (v.scoring as InterviewBlob["scoring"]) ?? null,
    debug: Array.isArray(v.debug) ? (v.debug as AiDebugEntry[]) : [],
  };
}

function toJson(blob: InterviewBlob): Prisma.InputJsonValue {
  // Keep the debug log bounded so the JSON column doesn't grow without limit.
  const trimmed: InterviewBlob = {
    ...blob,
    debug: blob.debug.slice(-MAX_DEBUG_ENTRIES),
  };
  return trimmed as unknown as Prisma.InputJsonValue;
}

async function persistBlob(attemptId: string, blob: InterviewBlob): Promise<void> {
  await prisma.aIInterviewAttempt.update({
    where: { id: attemptId },
    data: { responses: toJson(blob) },
  });
}

// ---------------------------------------------------------------------------
// Loader — attempt + application + job + question set, by invite token.
// ---------------------------------------------------------------------------

const attemptInclude = {
  application: {
    select: {
      id: true,
      status: true,
      jobPost: {
        select: {
          title: true,
          description: true,
          requirements: true,
          saudiClient: { select: { companyName: true } },
          aiInterviewSet: {
            include: { questions: { orderBy: { orderIndex: "asc" } } },
          },
        },
      },
      assessmentAttempt: { select: { score: true } },
    },
  },
  candidate: {
    select: { id: true, fullName: true, user: { select: { id: true, email: true } } },
  },
} satisfies Prisma.AIInterviewAttemptInclude;

type AttemptContext = Prisma.AIInterviewAttemptGetPayload<{
  include: typeof attemptInclude;
}>;

async function loadByToken(token: string): Promise<AttemptContext | null> {
  return prisma.aIInterviewAttempt.findUnique({
    where: { inviteLinkToken: token },
    include: attemptInclude,
  });
}

/** Derive the entry-screen state from a status + expiry (shared by the token
 * loader and the by-application lookup). */
function computeTokenState(
  status: AIInterviewStatus,
  expiresAt: Date | null,
): InterviewTokenState {
  if (status === "COMPLETED") return "COMPLETED";
  const expired =
    status === "EXPIRED" || (expiresAt != null && expiresAt.getTime() < Date.now());
  if (expired) return "EXPIRED";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  return "VALID";
}

function tokenState(attempt: AttemptContext): InterviewTokenState {
  return computeTokenState(attempt.status, attempt.inviteLinkExpiresAt);
}

// ---------------------------------------------------------------------------
// Question resolution (configured set, with a built-in fallback bank).
// ---------------------------------------------------------------------------

function resolveQuestions(attempt: AttemptContext): {
  questions: InterviewQuestionDTO[];
  questionTimeLimitSeconds: number;
  maxDurationMinutes: number;
} {
  const set = attempt.application.jobPost.aiInterviewSet;
  const questionTimeLimitSeconds =
    set?.questionTimeLimitSeconds ?? AI_INTERVIEW_QUESTION_TIME_LIMIT_SECONDS;
  const maxDurationMinutes = set?.maxDurationMinutes ?? 30;

  if (set && set.questions.length > 0) {
    const questions = set.questions.map((q, i) => ({
      id: q.id,
      order: i,
      questionText: q.questionText,
      questionType: q.questionType,
      maxTimeSeconds: q.maxTimeSeconds || questionTimeLimitSeconds,
    }));
    return { questions, questionTimeLimitSeconds, maxDurationMinutes };
  }

  // Fallback bank — synthesize stable ids so the transcript can key on them.
  const questions = DEFAULT_AI_INTERVIEW_QUESTIONS.map((q, i) => ({
    id: `default-${i + 1}`,
    order: i,
    questionText: q.questionText,
    questionType: q.questionType,
    maxTimeSeconds: questionTimeLimitSeconds,
  }));
  return { questions, questionTimeLimitSeconds, maxDurationMinutes };
}

function buildIntro(candidateName: string, jobTitle: string, count: number): string {
  const name = candidateName.trim().split(/\s+/)[0] || "there";
  return `Hello ${name}, I'm your AI interviewer for the ${jobTitle} position at Sublime International. This interview has ${count} ${count === 1 ? "question" : "questions"}. Take your time, speak clearly, and let's begin.`;
}

function toSessionDTO(attempt: AttemptContext): InterviewSessionDTO {
  const { questions, questionTimeLimitSeconds, maxDurationMinutes } =
    resolveQuestions(attempt);
  return {
    token: attempt.inviteLinkToken,
    candidateName: attempt.candidate.fullName,
    jobTitle: attempt.application.jobPost.title,
    companyName: attempt.application.jobPost.saudiClient.companyName,
    intro: buildIntro(
      attempt.candidate.fullName,
      attempt.application.jobPost.title,
      questions.length,
    ),
    questions,
    questionTimeLimitSeconds,
    maxDurationMinutes,
  };
}

// ---------------------------------------------------------------------------
// Entry screen + session resolution
// ---------------------------------------------------------------------------

/** Entry / device-check screen payload. `null` only when the token is unknown. */
export async function getInterviewEntry(
  token: string,
): Promise<InterviewEntryDTO | null> {
  const attempt = await loadByToken(token);
  if (!attempt) return null;

  const { questions, questionTimeLimitSeconds, maxDurationMinutes } =
    resolveQuestions(attempt);

  return {
    token,
    state: tokenState(attempt),
    candidateName: attempt.candidate.fullName,
    jobTitle: attempt.application.jobPost.title,
    companyName: attempt.application.jobPost.saudiClient.companyName,
    questionCount: questions.length,
    questionTimeLimitSeconds,
    maxDurationMinutes,
    expiresAt: attempt.inviteLinkExpiresAt?.toISOString() ?? null,
  };
}

/** Session payload for the live screen — only once started (else `null`). */
export async function getInterviewSession(
  token: string,
): Promise<InterviewSessionDTO | null> {
  const attempt = await loadByToken(token);
  if (!attempt) return null;
  if (tokenState(attempt) !== "IN_PROGRESS") return null;
  return toSessionDTO(attempt);
}

/**
 * The invite token + state for a candidate's interview on an application
 * (owner-scoped) — lets the candidate portal deep-link "Start AI Interview" to
 * `/interview/<token>`. `null` if there's no interview attempt for this
 * application.
 */
export async function getInviteTokenForApplication(
  applicationId: string,
  candidateId: string,
): Promise<{ token: string; state: InterviewTokenState } | null> {
  const attempt = await prisma.aIInterviewAttempt.findFirst({
    where: { applicationId, candidateId },
    select: { inviteLinkToken: true, status: true, inviteLinkExpiresAt: true },
  });
  if (!attempt) return null;
  return {
    token: attempt.inviteLinkToken,
    state: computeTokenState(attempt.status, attempt.inviteLinkExpiresAt),
  };
}

// ---------------------------------------------------------------------------
// Identity capture (device-check screen)
// ---------------------------------------------------------------------------

/** Store the CNIC identity snapshot; returns a short-lived preview URL. */
export async function captureIdentityPhoto(
  token: string,
  imageDataUrl: string,
): Promise<string> {
  const attempt = await loadByToken(token);
  if (!attempt) throw new InterviewError("Interview not found.", "NOT_FOUND");
  const state = tokenState(attempt);
  if (state === "COMPLETED")
    throw new InterviewError("This interview is already complete.", "ALREADY_COMPLETED");
  if (state === "EXPIRED")
    throw new InterviewError("This interview link has expired.", "EXPIRED");

  const stored = await uploadIdentitySnapshot(attempt.id, imageDataUrl);
  const blob = readBlob(attempt.responses);
  blob.identityPhotoUrl = stored.path;
  await persistBlob(attempt.id, blob);
  return stored.signedUrl ?? stored.path;
}

// ---------------------------------------------------------------------------
// Start (consent + begin)
// ---------------------------------------------------------------------------

export interface StartInterviewArgs {
  consent: boolean;
  deviceCheck: DeviceCheckInput;
  identityPhotoUrl: string | null;
}

/**
 * Begin (or resume) the interview: record consent, mark IN_PROGRESS, advance the
 * application to INTERVIEW_IN_PROGRESS and hand back the question set + intro.
 */
export async function startInterview(
  token: string,
  args: StartInterviewArgs,
): Promise<InterviewSessionDTO> {
  const attempt = await loadByToken(token);
  if (!attempt) throw new InterviewError("Interview not found.", "NOT_FOUND");
  const state = tokenState(attempt);
  if (state === "COMPLETED")
    throw new InterviewError("This interview is already complete.", "ALREADY_COMPLETED");
  if (state === "EXPIRED")
    throw new InterviewError("This interview link has expired.", "EXPIRED");
  if (!args.consent)
    throw new InterviewError("Recording consent is required.", "CONSENT_REQUIRED");

  const blob = readBlob(attempt.responses);
  blob.consentGivenAt = blob.consentGivenAt ?? new Date().toISOString();
  blob.deviceCheck = args.deviceCheck;
  if (args.identityPhotoUrl) blob.identityPhotoUrl = args.identityPhotoUrl;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.aIInterviewAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: attempt.startedAt ?? now,
        responses: toJson(blob),
      },
    });
    if (attempt.application.status !== "INTERVIEW_IN_PROGRESS") {
      await tx.application.update({
        where: { id: attempt.application.id },
        data: { status: "INTERVIEW_IN_PROGRESS" },
      });
    }
  });

  return toSessionDTO(attempt);
}

// ---------------------------------------------------------------------------
// Recording — chunk upload + finalize
// ---------------------------------------------------------------------------

/** Persist one streamed recording chunk to storage (during the interview). */
export async function uploadRecordingChunk(
  token: string,
  chunkIndex: number,
  bytes: Buffer,
  contentType?: string,
): Promise<void> {
  const attempt = await loadByToken(token);
  if (!attempt) throw new InterviewError("Interview not found.", "NOT_FOUND");
  if (tokenState(attempt) === "EXPIRED")
    throw new InterviewError("This interview link has expired.", "EXPIRED");

  await uploadStorageChunk(attempt.id, chunkIndex, bytes, contentType);

  const blob = readBlob(attempt.responses);
  blob.recording.chunkCount = Math.max(blob.recording.chunkCount, chunkIndex + 1);
  await persistBlob(attempt.id, blob);
}

/** Stitch chunks into the final WebM; persist the path, return a preview URL. */
export async function finalizeRecording(token: string): Promise<string | null> {
  const attempt = await loadByToken(token);
  if (!attempt) throw new InterviewError("Interview not found.", "NOT_FOUND");

  const stored = await finalizeStorageRecording(attempt.id);
  const blob = readBlob(attempt.responses);
  blob.recording.path = stored?.path ?? null;
  blob.recording.finalizedAt = new Date().toISOString();

  await prisma.aIInterviewAttempt.update({
    where: { id: attempt.id },
    data: { recordingUrl: stored?.path ?? null, responses: toJson(blob) },
  });

  return stored?.signedUrl ?? null;
}

// ---------------------------------------------------------------------------
// Live follow-up generation (Gemini)
// ---------------------------------------------------------------------------

export interface JobContext {
  jobTitle: string;
  jobDescription: string;
}

async function followUpFromModel(
  question: string,
  response: string,
  job: JobContext,
): Promise<{ followUp: string | null; debug: AiDebugEntry }> {
  const system = `You are an expert recruiter conducting a live, spoken interview for a ${job.jobTitle} position. You ask sharp, concise follow-up questions that probe the candidate's real depth — one at a time, conversational, never more than one sentence.`;
  const prompt = [
    job.jobDescription ? `Role context:\n${job.jobDescription}\n` : "",
    `The candidate was asked:\n"${question}"`,
    "",
    `Their transcribed answer:\n"${response || "(no answer was transcribed)"}"`,
    "",
    "Decide whether ONE short follow-up question would meaningfully probe this answer.",
    "If yes, reply with ONLY the follow-up question (a single sentence, no preamble).",
    "If a follow-up is not warranted, reply with exactly: NONE",
  ]
    .filter(Boolean)
    .join("\n");

  const { text, debug } = await runAi({
    kind: "follow_up",
    system,
    prompt,
    maxTokens: 256,
  });

  const trimmed = text.trim();
  const followUp =
    !trimmed || /^none\b/i.test(trimmed)
      ? null
      : trimmed.replace(/^["']+|["']+$/g, "").trim();
  return { followUp, debug };
}

/**
 * Documented helper (spec §4) — generate a follow-up question from a Q/A pair.
 * Returns an empty string when no follow-up is warranted.
 */
export async function generateFollowUp(
  question: string,
  response: string,
  jobContext: JobContext,
): Promise<string> {
  const { followUp } = await followUpFromModel(question, response, jobContext);
  return followUp ?? "";
}

/** Token-scoped follow-up used by the route — also persists the debug entry. */
export async function generateFollowUpForToken(
  token: string,
  questionId: string,
  question: string,
  response: string,
): Promise<string | null> {
  const attempt = await loadByToken(token);
  if (!attempt) throw new InterviewError("Interview not found.", "NOT_FOUND");
  if (tokenState(attempt) !== "IN_PROGRESS")
    throw new InterviewError("The interview is not in progress.", "NOT_STARTED");

  const job: JobContext = {
    jobTitle: attempt.application.jobPost.title,
    jobDescription: jobDescriptionOf(attempt),
  };

  try {
    const { followUp, debug } = await followUpFromModel(question, response, job);
    const blob = readBlob(attempt.responses);
    blob.debug.push(debug);
    await persistBlob(attempt.id, blob);
    return followUp;
  } catch (error) {
    // A follow-up is an enhancement — never block the interview on a failure.
    console.error(`Follow-up generation failed for question ${questionId}`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scoring (Gemini) + persistence
// ---------------------------------------------------------------------------

function jobDescriptionOf(attempt: AttemptContext): string {
  const { description, requirements } = attempt.application.jobPost;
  return [description, requirements].filter(Boolean).join("\n\n");
}

const scoreModelSchema = z.object({
  technicalScore: z.number(),
  communicationScore: z.number(),
  behavioralScore: z.number(),
  confidenceScore: z.number(),
  overallInterviewScore: z.number(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  aiSummary: z.string(),
  recommendation: z.enum([
    "STRONG_RECOMMEND",
    "RECOMMEND",
    "NEUTRAL",
    "NOT_RECOMMEND",
  ]),
});

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildTranscriptText(entries: InterviewTranscriptEntry[]): string {
  return entries
    .map((e, i) => {
      const lines = [
        `Q${i + 1} [${e.questionType}]: ${e.questionText}`,
        `A${i + 1}: ${e.answerText?.trim() || "(no answer transcribed)"}`,
      ];
      if (e.followUpQuestion) {
        lines.push(`Follow-up: ${e.followUpQuestion}`);
        lines.push(
          `Follow-up answer: ${e.followUpAnswerText?.trim() || "(no answer transcribed)"}`,
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

/** Pull the first balanced JSON object out of the model's text. */
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new InterviewError("Evaluator returned no JSON.", "SCORING_FAILED");
  }
  return text.slice(start, end + 1);
}

/**
 * Score an interview transcript with Gemini, persist the scored columns + the
 * qualitative extras (strengths / improvements / recommendation), and return
 * the normalised scores. The raw model response is kept in the debug log.
 */
export async function scoreInterview(
  attemptId: string,
  transcript: InterviewTranscriptEntry[],
): Promise<InterviewScores> {
  const attempt = await prisma.aIInterviewAttempt.findUnique({
    where: { id: attemptId },
    include: attemptInclude,
  });
  if (!attempt) throw new InterviewError("Interview not found.", "NOT_FOUND");

  const jobTitle = attempt.application.jobPost.title;
  const jobDescription = jobDescriptionOf(attempt) || "(no role description provided)";
  const transcriptText = buildTranscriptText(transcript);

  const prompt = [
    `You are an expert recruiter evaluating a candidate for a ${jobTitle} position.`,
    "Evaluate the following interview transcript and provide scores and analysis.",
    "",
    `Job Requirements: ${jobDescription}`,
    "",
    "Transcript:",
    transcriptText,
    "",
    "Provide a JSON response with:",
    "- technicalScore (0-100): knowledge relevant to the role",
    "- communicationScore (0-100): clarity, fluency, English proficiency",
    "- behavioralScore (0-100): situation handling, professionalism",
    "- confidenceScore (0-100): tone, hesitation, response completeness",
    "- overallInterviewScore (0-100): weighted average",
    "- strengths: array of 3 key strengths",
    "- improvements: array of 2-3 areas for development",
    "- aiSummary: a 2-3 sentence professional summary",
    "- recommendation: one of STRONG_RECOMMEND | RECOMMEND | NEUTRAL | NOT_RECOMMEND",
    "",
    "Some answers may be missing transcription; judge only on what is present and",
    "note limited evidence in the summary rather than inventing detail.",
    "Respond with ONLY a single minified JSON object and nothing else.",
  ].join("\n");

  const { text, debug } = await runAi({
    kind: "scoring",
    system:
      "You are a fair, rigorous technical recruiter. You output only valid JSON.",
    prompt,
    maxTokens: 1_500,
    json: true, // Gemini JSON mode → reliable, parseable output
  });

  let scores: InterviewScores;
  try {
    const parsed = scoreModelSchema.parse(JSON.parse(extractJsonObject(text)));
    scores = {
      technicalScore: clampScore(parsed.technicalScore),
      communicationScore: clampScore(parsed.communicationScore),
      behavioralScore: clampScore(parsed.behavioralScore),
      confidenceScore: clampScore(parsed.confidenceScore),
      overallInterviewScore: clampScore(parsed.overallInterviewScore),
      strengths: parsed.strengths.slice(0, 5),
      improvements: parsed.improvements.slice(0, 5),
      aiSummary: parsed.aiSummary,
      recommendation: parsed.recommendation,
    };
  } catch (error) {
    debug.error = `Parse/validation failed: ${error instanceof Error ? error.message : String(error)}`;
    const blob = readBlob(attempt.responses);
    blob.debug.push(debug);
    await persistBlob(attempt.id, blob).catch(() => {});
    throw new InterviewError(
      "Could not parse the evaluator's response.",
      "SCORING_FAILED",
    );
  }

  const blob = readBlob(attempt.responses);
  blob.transcript = transcript;
  blob.scoring = {
    strengths: scores.strengths,
    improvements: scores.improvements,
    recommendation: scores.recommendation,
  };
  blob.debug.push(debug);

  await prisma.aIInterviewAttempt.update({
    where: { id: attempt.id },
    data: {
      technicalScore: scores.technicalScore,
      communicationScore: scores.communicationScore,
      behavioralScore: scores.behavioralScore,
      confidenceScore: scores.confidenceScore,
      overallInterviewScore: scores.overallInterviewScore,
      aiSummary: scores.aiSummary,
      responses: toJson(blob),
    },
  });

  return scores;
}

// ---------------------------------------------------------------------------
// Tiering
// ---------------------------------------------------------------------------

/**
 * Blend Stage-1 (assessment) and Stage-2 (interview) scores into the final
 * weighted score, assign the tier, persist the record and advance the pipeline.
 */
export async function calculateFinalTier(applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      candidateId: true,
      assessmentAttempt: { select: { score: true } },
      aiInterviewAttempt: { select: { overallInterviewScore: true } },
    },
  });
  if (!app) throw new InterviewError("Application not found.", "NOT_FOUND");

  const assessmentScore = app.assessmentAttempt?.score ?? null;
  const interviewScore = app.aiInterviewAttempt?.overallInterviewScore ?? null;
  const finalScore = calculateFinalScore(assessmentScore, interviewScore);
  const tier = assignTier(finalScore);

  const record = await createTierRecord({
    applicationId,
    candidateId: app.candidateId,
    assessmentScore,
    interviewScore,
    finalScore,
    tier,
  });

  // Tiered → surfaces to the candidate as "Shortlisted" and enters the pool.
  await updateApplicationStage(applicationId, "TIERED");

  return record;
}

// ---------------------------------------------------------------------------
// Completion — score, tier, notify (the route entry point)
// ---------------------------------------------------------------------------

export interface CompleteInterviewArgs {
  transcript: InterviewTranscriptEntry[];
  recordingUrl: string | null;
  durationSeconds: number;
}

/**
 * Finish the interview: persist the transcript, mark COMPLETED, run scoring and
 * tiering, then return the result **plus** an `afterResponse` callback. Scoring
 * is what the candidate waits on; the slow recording stitch (download → concat →
 * re-upload) and the notifications (email + in-app) are deferred into
 * `afterResponse`, which the route runs via `after()` once the result has been
 * sent — so the results screen appears as soon as the score is ready.
 *
 * Idempotent — a re-submit of an already-scored interview returns the existing
 * result instead of re-charging Gemini (and skips re-notifying).
 */
export async function completeAndScore(
  token: string,
  args: CompleteInterviewArgs,
): Promise<{ result: InterviewScoreResult; afterResponse: () => Promise<void> }> {
  const attempt = await loadByToken(token);
  if (!attempt) throw new InterviewError("Interview not found.", "NOT_FOUND");

  const alreadyScored =
    attempt.status === "COMPLETED" && attempt.overallInterviewScore != null;

  if (!alreadyScored) {
    if (tokenState(attempt) === "EXPIRED")
      throw new InterviewError("This interview link has expired.", "EXPIRED");

    await prisma.aIInterviewAttempt.update({
      where: { id: attempt.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await prisma.application
      .update({
        where: { id: attempt.application.id },
        data: { status: "INTERVIEW_COMPLETED" },
      })
      .catch(() => {});

    await scoreInterview(attempt.id, args.transcript);
  }

  const record = await calculateFinalTier(attempt.application.id);

  // Reload the scored attempt for the response payload.
  const scored = await prisma.aIInterviewAttempt.findUnique({
    where: { id: attempt.id },
    select: {
      technicalScore: true,
      communicationScore: true,
      behavioralScore: true,
      confidenceScore: true,
      overallInterviewScore: true,
      aiSummary: true,
      responses: true,
    },
  });
  const blob = readBlob(scored?.responses ?? null);
  const scores: InterviewScores = {
    technicalScore: scored?.technicalScore ?? 0,
    communicationScore: scored?.communicationScore ?? 0,
    behavioralScore: scored?.behavioralScore ?? 0,
    confidenceScore: scored?.confidenceScore ?? 0,
    overallInterviewScore: scored?.overallInterviewScore ?? 0,
    strengths: blob.scoring?.strengths ?? [],
    improvements: blob.scoring?.improvements ?? [],
    aiSummary: scored?.aiSummary ?? "",
    recommendation: blob.scoring?.recommendation ?? "NEUTRAL",
  };

  const tier: TierRecordDTO = {
    tier: record.tier,
    finalScore: record.finalScore ?? 0,
    assessmentScore: record.assessmentScore,
    interviewScore: record.interviewScore,
    assessmentWeight: Number(record.assessmentWeight),
    interviewWeight: Number(record.interviewWeight),
  };

  const notifyArgs: NotifyArgs = {
    userId: attempt.candidate.user.id,
    email: attempt.candidate.user.email,
    candidateName: attempt.candidate.fullName,
    applicationId: attempt.application.id,
    jobTitle: attempt.application.jobPost.title,
    companyName: attempt.application.jobPost.saudiClient.companyName,
    tier,
  };

  // Deferred to `after()` in the route — heavy/non-urgent and irrelevant to the
  // score the candidate is waiting for: stitch the recording, then notify.
  const afterResponse = async (): Promise<void> => {
    try {
      await finalizeRecording(token);
    } catch (error) {
      console.error("Background recording finalize failed", error);
    }
    if (!alreadyScored) {
      try {
        await notifyTierAssigned(notifyArgs);
      } catch (error) {
        console.error("Background tier notification failed", error);
      }
    }
  };

  return { result: { scores, tier }, afterResponse };
}

// ---------------------------------------------------------------------------
// Notifications (candidate email + in-app, admin in-app)
// ---------------------------------------------------------------------------

interface NotifyArgs {
  userId: string;
  email: string;
  candidateName: string;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  tier: TierRecordDTO;
}

async function notifyTierAssigned(args: NotifyArgs): Promise<void> {
  const tierLabel = CANDIDATE_TIER_LABELS[args.tier.tier];

  // Candidate result email (best-effort).
  try {
    const template = interviewTierResultEmail({
      candidateName: args.candidateName,
      jobTitle: args.jobTitle,
      companyName: args.companyName,
      tierLabel,
      finalScore: args.tier.finalScore,
      applicationUrl: absoluteUrl(`${ROUTES.CANDIDATE}/applications/${args.applicationId}`),
    });
    await sendEmail(args.email, template);
  } catch (error) {
    console.error("Failed to send tier result email", error);
  }

  // Candidate in-app notification (best-effort).
  try {
    await prisma.notification.create({
      data: {
        userId: args.userId,
        type: "TIER_ASSIGNED",
        title: `You've been shortlisted — ${tierLabel} tier`,
        message: `Your AI interview for ${args.jobTitle} at ${args.companyName} is complete. You've been placed in the ${tierLabel} tier.`,
        link: `${ROUTES.CANDIDATE}/applications/${args.applicationId}`,
      },
    });
  } catch (error) {
    console.error("Failed to create candidate tier notification", error);
  }

  // Admin in-app notifications — every Admin / Super Admin (best-effort).
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "TIER_ASSIGNED" as const,
          title: "New shortlisted candidate",
          message: `${args.candidateName} completed the AI interview for ${args.jobTitle} — assigned ${tierLabel} tier (final score ${Math.round(args.tier.finalScore)}).`,
          link: `${ROUTES.ADMIN}/applications/${args.applicationId}`,
        })),
      });
    }
  } catch (error) {
    console.error("Failed to create admin shortlist notifications", error);
  }
}
