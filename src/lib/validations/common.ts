import { z } from "zod";

/**
 * Reusable Zod primitives shared across SIORP forms and APIs (Rule #6).
 * Compose these into feature-specific schemas in this folder.
 */

/** Pakistani CNIC: 13 digits, optionally formatted xxxxx-xxxxxxx-x. */
export const cnicSchema = z
  .string()
  .trim()
  .regex(/^\d{5}-?\d{7}-?\d$/, "Enter a valid 13-digit CNIC");

/** Pakistani mobile number, e.g. +923001234567 or 03001234567. */
export const pakistaniPhoneSchema = z
  .string()
  .trim()
  .regex(/^(?:\+92|0)3\d{9}$/, "Enter a valid Pakistani mobile number");

export const emailSchema = z.email("Enter a valid email address");

/** Password policy — SRS §3.1.1 FR-AUTH-005. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

/** Standard list pagination input (coerces query-string values). */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
