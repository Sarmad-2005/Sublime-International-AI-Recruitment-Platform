import { z } from "zod";
import { JOB_SECTORS } from "@/lib/constants";

/**
 * Job Board query schema (Rule #6) — parses the candidate-facing job listing
 * filters straight from URL `searchParams`, so the same shape backs the Server
 * Component page and the `/api/jobs` route powering live filter/search.
 *
 * Every field is optional and coerced: empty strings (a cleared filter still
 * present in the URL) collapse to `undefined` so they don't over-constrain the
 * query.
 */

/** Treat empty strings / missing values as `undefined` before coercion. */
const emptyAsUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

/** Page size for the Job Board (SRS: 20 per page). */
export const JOB_BOARD_PAGE_SIZE = 20;

/** Preset salary floors (major units, SAR) offered in the filter sidebar. */
export const SALARY_FILTER_OPTIONS = [1000, 1500, 2000, 3000, 5000] as const;

/** Preset "date posted" windows (days) offered in the filter sidebar. */
export const DATE_POSTED_OPTIONS = [
  { value: 1, label: "Last 24 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
] as const;

export const jobBoardQuerySchema = z.object({
  search: z.preprocess(
    emptyAsUndefined,
    z.string().trim().max(100).optional(),
  ),
  sector: z.preprocess(emptyAsUndefined, z.enum(JOB_SECTORS).optional()),
  country: z.preprocess(
    emptyAsUndefined,
    z.string().trim().max(60).optional(),
  ),
  salaryMin: z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().min(0).optional(),
  ),
  postedWithinDays: z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().min(1).max(365).optional(),
  ),
  page: z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().min(1).default(1),
  ),
});

export type JobBoardQueryInput = z.infer<typeof jobBoardQuerySchema>;
