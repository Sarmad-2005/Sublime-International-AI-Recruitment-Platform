import { z } from "zod";

import { CANDIDATE_TIER_VALUES } from "@/lib/constants";

/**
 * Zod schemas for the Saudi Client Portal (SRS §3.8 M7). Shared between the
 * client Server Actions and any client-facing forms (Rule #6).
 */

/** Client-review states a client may set on a pooled candidate. */
export const CLIENT_REVIEW_STATUS_VALUES = [
  "UNREVIEWED",
  "INTERESTED",
  "NOT_INTERESTED",
  "SHORTLISTED_FOR_INTERVIEW",
] as const;

/** Set the client's interest signal on a candidate in their pool. */
export const clientCandidateStatusSchema = z.object({
  applicationId: z.uuid(),
  status: z.enum([
    "INTERESTED",
    "NOT_INTERESTED",
    "SHORTLISTED_FOR_INTERVIEW",
  ]),
});

export type ClientCandidateStatusInput = z.infer<
  typeof clientCandidateStatusSchema
>;

/** Send a message (with optional document attachment) to the admin team. */
export const sendClientMessageSchema = z
  .object({
    content: z.string().trim().max(4000, "Message is too long.").default(""),
    attachmentUrl: z.url().optional().nullable(),
    attachmentName: z.string().trim().max(255).optional().nullable(),
  })
  .refine(
    (data) => data.content.length > 0 || Boolean(data.attachmentUrl),
    { message: "Enter a message or attach a file.", path: ["content"] },
  );

export type SendClientMessageInput = z.infer<typeof sendClientMessageSchema>;

/** Talent-pool filter query, coerced from URL searchParams. */
export const clientPoolFiltersSchema = z.object({
  jobPostId: z.uuid().nullish(),
  tier: z.enum(CANDIDATE_TIER_VALUES as [string, ...string[]]).nullish(),
  status: z.enum(CLIENT_REVIEW_STATUS_VALUES).nullish(),
  q: z.string().trim().min(1).nullish(),
  page: z.coerce.number().int().min(1).default(1),
});
