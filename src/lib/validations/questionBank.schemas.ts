import { z } from "zod";

import {
  AI_INTERVIEW_QUESTION_TYPE_VALUES,
  MAX_ANSWER_OPTIONS,
  MIN_ANSWER_OPTIONS,
  QUESTION_TYPE_VALUES,
  SINGLE_ANSWER_QUESTION_TYPES,
} from "@/lib/constants";

/**
 * Question-bank & AI-interview-set schemas (Rule #6) — shared by the admin
 * editor forms and the `question-banks` / `interview-sets` server actions.
 */

// ---------------------------------------------------------------------------
// Assessment questions
// ---------------------------------------------------------------------------

export const questionOptionSchema = z.object({
  /** Stable id — scoring keys off this, so it must survive edits/reorders. */
  id: z.string().min(1),
  text: z.string().max(500).default(""),
  imageUrl: z.string().url().nullable().default(null),
});

export type QuestionOptionInput = z.infer<typeof questionOptionSchema>;

export const assessmentQuestionSchema = z
  .object({
    type: z.enum(QUESTION_TYPE_VALUES),
    questionText: z
      .string()
      .min(1, "Question text is required")
      .max(2000, "Question text is too long"),
    imageUrl: z.string().url().nullable().optional().default(null),
    options: z
      .array(questionOptionSchema)
      .min(MIN_ANSWER_OPTIONS, `Add at least ${MIN_ANSWER_OPTIONS} options`)
      .max(MAX_ANSWER_OPTIONS, `No more than ${MAX_ANSWER_OPTIONS} options`),
    correctAnswers: z
      .array(z.string().min(1))
      .min(1, "Mark at least one correct answer"),
    points: z.coerce.number().int().min(1).max(100).default(1),
  })
  .superRefine((q, ctx) => {
    // Every option must have text or an image.
    q.options.forEach((o, i) => {
      if (!o.text.trim() && !o.imageUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Option needs text or an image",
          path: ["options", i, "text"],
        });
      }
    });

    // Correct answers must reference existing options.
    const optionIds = new Set(q.options.map((o) => o.id));
    const unknown = q.correctAnswers.some((id) => !optionIds.has(id));
    if (unknown) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Correct answer no longer matches an option",
        path: ["correctAnswers"],
      });
    }

    // Single-answer types accept exactly one correct answer.
    const isSingle = (SINGLE_ANSWER_QUESTION_TYPES as readonly string[]).includes(
      q.type,
    );
    if (isSingle && q.correctAnswers.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This question type must have exactly one correct answer",
        path: ["correctAnswers"],
      });
    }

    // Image-based questions need a question image.
    if (q.type === "IMAGE_BASED" && !q.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Upload an image for an image-based question",
        path: ["imageUrl"],
      });
    }
  });

export type AssessmentQuestionInput = z.infer<typeof assessmentQuestionSchema>;

// ---------------------------------------------------------------------------
// Question bank settings
// ---------------------------------------------------------------------------

export const questionBankSettingsSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(200),
  description: z.string().max(1000).nullable().optional().default(null),
  timeLimitMinutes: z.coerce.number().int().min(1).max(300).default(30),
  passingScore: z.coerce.number().int().min(0).max(100).default(60),
  allowRetake: z.boolean().default(false),
  retakeCooldownDays: z.coerce.number().int().min(0).max(365).default(0),
  randomizeQuestions: z.boolean().default(true),
  randomizeAnswers: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export type QuestionBankSettingsInput = z.infer<typeof questionBankSettingsSchema>;

/** Create payload — a bank must be linked to a job post (unique 1:1). */
export const createQuestionBankSchema = questionBankSettingsSchema.extend({
  jobPostId: z.string().min(1, "Select a job post"),
});

export type CreateQuestionBankInput = z.infer<typeof createQuestionBankSchema>;

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

/** One parsed CSV row before it is validated into a question. */
export const csvQuestionRowSchema = z.object({
  type: z.enum(QUESTION_TYPE_VALUES),
  questionText: z.string().min(1),
  options: z.array(z.string()).min(MIN_ANSWER_OPTIONS).max(MAX_ANSWER_OPTIONS),
  /** 1-based indices of the correct options within `options`. */
  correctIndices: z.array(z.number().int().min(1)).min(1),
  points: z.number().int().min(1).max(100).default(1),
});

export type CsvQuestionRow = z.infer<typeof csvQuestionRowSchema>;

// ---------------------------------------------------------------------------
// AI interview set settings
// ---------------------------------------------------------------------------

export const interviewSetSettingsSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(200),
  description: z.string().max(1000).nullable().optional().default(null),
  maxDurationMinutes: z.coerce.number().int().min(1).max(180).default(30),
  questionTimeLimitSeconds: z.coerce.number().int().min(15).max(600).default(90),
  isActive: z.boolean().default(true),
});

export type InterviewSetSettingsInput = z.infer<typeof interviewSetSettingsSchema>;

export const createInterviewSetSchema = interviewSetSettingsSchema.extend({
  jobPostId: z.string().min(1, "Select a job post"),
});

export type CreateInterviewSetInput = z.infer<typeof createInterviewSetSchema>;

// ---------------------------------------------------------------------------
// AI interview questions
// ---------------------------------------------------------------------------

export const interviewQuestionSchema = z.object({
  questionText: z
    .string()
    .min(1, "Question text is required")
    .max(2000, "Question text is too long"),
  questionType: z.enum(AI_INTERVIEW_QUESTION_TYPE_VALUES),
  expectedKeywords: z.array(z.string().min(1).max(60)).max(30).default([]),
  maxTimeSeconds: z.coerce.number().int().min(15).max(600).default(90),
});

export type InterviewQuestionInput = z.infer<typeof interviewQuestionSchema>;
