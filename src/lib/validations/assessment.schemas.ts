import { z } from "zod";

/**
 * Trade-assessment schemas (Rule #6) — shared by the assessment interface and
 * the `/api/assessment/*` routes.
 *
 * Answers are a map of `questionId → selected option ids`. A question may have
 * zero selected options (unanswered) or several (multi-select), so the value is
 * a string array.
 */
export const assessmentAnswersSchema = z.record(
  z.string(),
  z.array(z.string()),
);

export type AssessmentAnswers = z.infer<typeof assessmentAnswersSchema>;

/** Body of `POST /api/assessment/[applicationId]/submit`. */
export const submitAssessmentSchema = z.object({
  answers: assessmentAnswersSchema,
  /** Set by the client when auto-submitting after the tab-switch limit. */
  flaggedSuspicious: z.boolean().optional().default(false),
});

export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;
