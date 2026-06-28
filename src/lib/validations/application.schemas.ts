import { z } from "zod";

/**
 * Application schemas (Rule #6) — shared by the `ApplyModal` and the
 * `POST /api/applications` route. Creating an application records the job the
 * candidate is applying to, the CV they're submitting with, and their explicit
 * acknowledgement that the information is accurate.
 */
export const createApplicationSchema = z.object({
  jobPostId: z.uuid("A valid job is required."),
  /** CV submitted with this application (defaults to the profile CV). */
  cvUrl: z.url("A valid CV URL is required."),
  /** "I confirm all information is accurate" — must be checked to submit. */
  acknowledged: z.literal(true, {
    error: "Please confirm your information is accurate before applying.",
  }),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
