import { z } from "zod";
import {
  EducationLevel,
  Gender,
  MaritalStatus,
} from "@/generated/prisma/enums";

/**
 * Candidate profile schemas (Rule #6) — shared by the React Hook Form resolvers
 * on the profile tabs and the `/api/candidate/profile` route on the server.
 *
 * The profile is edited section by section (Personal / Documents / Education),
 * and each section saves independently, so every section has its own schema and
 * they compose into `updateCandidateProfileSchema` for the PATCH endpoint.
 * Enum values come straight from the generated Prisma enums so the form, API and
 * database always share one source of truth.
 */

// ---------------------------------------------------------------------------
// Format helpers (display masks for CNIC + phone)
// ---------------------------------------------------------------------------

/** Strip everything but digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Mask raw input into CNIC display format `XXXXX-XXXXXXX-X` as the user types. */
export function formatCnic(value: string): string {
  const d = digitsOnly(value).slice(0, 13);
  const parts = [d.slice(0, 5), d.slice(5, 12), d.slice(12, 13)].filter(Boolean);
  return parts.join("-");
}

/** Mask raw input into Pakistani phone display format `03XX-XXXXXXX`. */
export function formatPakistaniPhone(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)}-${d.slice(4)}`;
}

// ---------------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------------

/** CNIC strictly in `XXXXX-XXXXXXX-X` display format (FR-CAND-001). */
export const cnicDisplaySchema = z
  .string()
  .trim()
  .regex(/^\d{5}-\d{7}-\d$/, "CNIC must be in the format 12345-1234567-1");

/** Pakistani mobile strictly in `03XX-XXXXXXX` display format. */
export const phoneDisplaySchema = z
  .string()
  .trim()
  .regex(/^03\d{2}-\d{7}$/, "Phone must be in the format 0300-1234567");

/** Optional variant of {@link phoneDisplaySchema} (empty string → undefined). */
export const optionalPhoneDisplaySchema = z
  .union([phoneDisplaySchema, z.literal("")])
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/** `<input type="date">` value (`yyyy-MM-dd`). */
const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

const optionalIsoDateSchema = z
  .union([isoDateSchema, z.literal("")])
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalText = (max = 200) =>
  z
    .union([z.string().trim().max(max), z.literal("")])
    .transform((v) => (v === "" ? undefined : v))
    .optional();

const dateOfBirthSchema = isoDateSchema.refine(
  (value) => {
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return false;
    const now = new Date();
    const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 18 && age <= 70;
  },
  { message: "Candidate must be between 18 and 70 years old" },
);

// ---------------------------------------------------------------------------
// Section 1 — Personal info (BEOE) — SRS §3.3.1 FR-CAND-001
// ---------------------------------------------------------------------------
export const personalInfoSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name must be at most 100 characters"),
  fatherName: z
    .string()
    .trim()
    .min(2, "Please enter your father's name")
    .max(100, "Name must be at most 100 characters"),
  cnic: cnicDisplaySchema,
  dateOfBirth: dateOfBirthSchema,
  gender: z.enum(Gender),
  nationality: z.string().trim().min(2).max(60).default("Pakistani"),
  maritalStatus: z.enum(MaritalStatus).optional(),
  religion: optionalText(60),

  // Passport (optional at this stage; required before deployment).
  passportNumber: optionalText(20),
  passportIssueDate: optionalIsoDateSchema,
  passportExpiryDate: optionalIsoDateSchema,
  passportIssuePlace: optionalText(60),

  // Address.
  permanentAddress: z
    .string()
    .trim()
    .min(5, "Please enter your permanent address")
    .max(300),
  currentAddress: optionalText(300),
  city: z.string().trim().min(2, "Please enter your city").max(80),
  province: optionalText(80),
  country: z.string().trim().min(2).max(60).default("Pakistan"),
  postalCode: optionalText(15),

  // Emergency contact.
  emergencyContactName: optionalText(100),
  emergencyContactRelation: optionalText(60),
  emergencyContactPhone: optionalPhoneDisplaySchema,
  emergencyContactAddress: optionalText(300),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

// ---------------------------------------------------------------------------
// Section 2 — Documents — SRS §3.3.2 FR-CAND-002
// ---------------------------------------------------------------------------
export const documentsSchema = z.object({
  profilePhotoUrl: z.union([z.url(), z.literal("")]).optional(),
  cvUrl: z.union([z.url(), z.literal("")]).optional(),
  passportCopyUrl: z.union([z.url(), z.literal("")]).optional(),
});

export type DocumentsInput = z.infer<typeof documentsSchema>;

// ---------------------------------------------------------------------------
// Section 3 — Education & skills — SRS §3.3.1 FR-CAND-001
// ---------------------------------------------------------------------------
export const educationSkillsSchema = z.object({
  educationLevel: z.enum(EducationLevel),
  primaryTrade: z
    .string()
    .trim()
    .min(2, "Please enter your primary trade")
    .max(80),
  secondaryTrade: optionalText(80),
  yearsOfExperience: z.coerce
    .number()
    .int("Enter a whole number")
    .min(0, "Cannot be negative")
    .max(60, "That seems too high"),
});

export type EducationSkillsInput = z.infer<typeof educationSkillsSchema>;

// ---------------------------------------------------------------------------
// Combined partial update — backs PATCH /api/candidate/profile
// ---------------------------------------------------------------------------
export const updateCandidateProfileSchema = personalInfoSchema
  .partial()
  .extend(documentsSchema.partial().shape)
  .extend(educationSkillsSchema.partial().shape);

export type UpdateCandidateProfileInput = z.infer<
  typeof updateCandidateProfileSchema
>;
