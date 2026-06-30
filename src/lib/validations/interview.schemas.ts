import { z } from "zod";

/**
 * AI-interview schemas (SRS M5, Rule #6) — shared by the candidate interview
 * client and the token-scoped `/api/interview/[token]/*` routes.
 *
 * Interview answers reach scoring as text: the question is read aloud (Web
 * Speech TTS) and the candidate's spoken reply is transcribed in-browser (Web
 * Speech STT) into `answerText`. The recording itself is uploaded separately as
 * binary chunks (not validated here — see the recording routes).
 */

/** The four AI-interview question categories (Prisma `AIInterviewQuestionType`). */
export const interviewQuestionTypeSchema = z.enum([
  "TECHNICAL",
  "BEHAVIORAL",
  "COMMUNICATION",
  "MOTIVATION",
]);

export type InterviewQuestionType = z.infer<typeof interviewQuestionTypeSchema>;

/** Result of the pre-interview device check (camera / mic / latency probe). */
export const deviceCheckSchema = z.object({
  camera: z.boolean(),
  microphone: z.boolean(),
  /** Round-trip latency of the connectivity probe, ms (null if it failed). */
  latencyMs: z.number().int().nonnegative().nullable(),
});

export type DeviceCheckInput = z.infer<typeof deviceCheckSchema>;

/** Body of `POST /api/interview/[token]/identity` — CNIC snapshot data URL. */
export const interviewIdentitySchema = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Expected an image data URL.")
    .max(8_000_000, "Snapshot is too large."),
});

export type InterviewIdentityInput = z.infer<typeof interviewIdentitySchema>;

/** Body of `POST /api/interview/[token]/start`. */
export const startInterviewSchema = z.object({
  /** Recording consent — must be explicitly granted to begin. */
  consent: z.literal(true),
  deviceCheck: deviceCheckSchema,
  /** URL returned by the identity route, if the snapshot was captured. */
  identityPhotoUrl: z.string().url().nullable().optional().default(null),
});

export type StartInterviewInput = z.infer<typeof startInterviewSchema>;

/** Body of `POST /api/interview/[token]/follow-up`. */
export const interviewFollowUpSchema = z.object({
  questionId: z.string().min(1),
  question: z.string().min(1).max(2_000),
  /** Transcribed candidate answer the follow-up should build on. */
  response: z.string().max(20_000),
});

export type InterviewFollowUpInput = z.infer<typeof interviewFollowUpSchema>;

/** One answered question (plus an optional AI follow-up) in the transcript. */
export const interviewTranscriptEntrySchema = z.object({
  order: z.number().int().nonnegative(),
  questionId: z.string().min(1),
  questionText: z.string().min(1).max(2_000),
  questionType: interviewQuestionTypeSchema,
  /** In-browser transcription of the spoken answer (may be empty). */
  answerText: z.string().max(20_000).default(""),
  durationSeconds: z.number().int().nonnegative().max(36_000).default(0),
  followUpQuestion: z.string().max(2_000).nullable().optional().default(null),
  followUpAnswerText: z.string().max(20_000).nullable().optional().default(null),
});

export type InterviewTranscriptEntry = z.infer<
  typeof interviewTranscriptEntrySchema
>;

/** Body of `POST /api/interview/[token]/score` (interview completion). */
export const scoreInterviewSchema = z.object({
  transcript: z.array(interviewTranscriptEntrySchema).min(1, "Transcript is empty."),
  recordingUrl: z.string().url().nullable().optional().default(null),
  durationSeconds: z.number().int().nonnegative().optional().default(0),
});

export type ScoreInterviewInput = z.infer<typeof scoreInterviewSchema>;
