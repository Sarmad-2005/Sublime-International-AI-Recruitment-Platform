import type {
  CandidateTier,
  ClientInterest,
  Currency,
  DestinationCountry,
  EducationLevel,
  JobPostStatus,
  JobSector,
  PipelineStage,
  PostSelectionStage,
  PostSelectionStatus,
  UserRole,
} from "@/lib/constants";

/**
 * Global TypeScript types & interfaces for SIORP, aligned to the SRS
 * (SRS-SIORP-2026-001 v1.0). Database row types are generated separately by
 * Prisma (`@/generated/prisma`); these describe entities at the
 * application/service boundary.
 */

export type Gender = "MALE" | "FEMALE";

/** Common audit fields shared by all persisted entities. */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// User & auth — SRS §2.3, §3.1
// ---------------------------------------------------------------------------
export interface User extends BaseEntity {
  /** Supabase auth user id (auth.users.id). */
  authId: string;
  email: string;
  fullName: string;
  /** Pakistani mobile (03xx format) — required for candidates (FR-AUTH-001). */
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  /** Both email AND phone must be verified to activate (FR-AUTH-004). */
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  lastLoginAt: Date | null;
}

/**
 * The SIORP `users` row joined with its role — returned by the auth service
 * (`getCurrentUser`, `signIn`, `signUp`). The `id` is shared with the Supabase
 * Auth user id. Server-side shape; `Date` fields are real `Date`s.
 */
export interface UserWithRole {
  id: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Uniform result returned by the auth service mutations. */
export interface AuthResult {
  success: boolean;
  user: UserWithRole | null;
  /** Plain-English message when `success` is `false`, else `null`. */
  error: string | null;
}

/**
 * Lightweight candidate profile surfaced in the auth/session context (e.g.
 * `useCurrentCandidate`). The full BEOE profile lives in the candidate service.
 * JSON-safe: no `Date` fields, so it survives the `/api/auth/me` round-trip.
 */
export interface CandidateProfileSummary {
  id: string;
  userId: string;
  fullName: string;
  primaryTrade: string;
  secondaryTrade: string | null;
  yearsOfExperience: number;
  city: string;
  profilePhotoUrl: string | null;
}

/** Response shape of `GET /api/auth/me`. */
export interface MeResponse {
  candidate: CandidateProfileSummary | null;
}

// ---------------------------------------------------------------------------
// Candidate profile (BEOE-compliant) — SRS §3.3.1 FR-CAND-001
// ---------------------------------------------------------------------------
export interface Candidate extends BaseEntity {
  userId: string;
  /** Full name as per CNIC. */
  fullName: string;
  fatherName: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  /** Pakistani 13-digit national identity number. */
  cnic: string;
  passportNo: string | null;
  passportExpiry: Date | null;
  /** BEOE emigration badge number, tracked through deployment. */
  emigrationBadgeNo: string | null;
  permanentAddress: string | null;
  city: string | null;
  district: string | null;
  province: string | null;
  educationLevel: EducationLevel | null;
  primaryTrade: string | null;
  secondaryTrade: string | null;
  yearsOfExperience: number;
  /** Mandatory at profile completion (JPEG/PNG, min 300×300). */
  profilePhotoUrl: string | null;
  cvUrl: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

// ---------------------------------------------------------------------------
// Job post — SRS §3.2.1 FR-JOB-002 / FR-JOB-003
// ---------------------------------------------------------------------------
/** Per-job tier score cut-offs ("Classification Thresholds", FR-JOB-002). */
export interface TierThresholds {
  diamondMin: number;
  platinumMin: number;
  goldMin: number;
  bronzeMin: number;
}

export interface JobPost extends BaseEntity {
  /** Owning Saudi client (company) id. */
  clientId: string;
  /** Job title / designation, e.g. "Electrician — Saudi Arabia". */
  title: string;
  sector: JobSector;
  destinationCountry: DestinationCountry;
  description: string;
  requiredQualifications: string | null;
  vacancies: number;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: Currency;
  /** Benefits, e.g. accommodation / medical / transport. */
  benefits: string[];
  contractDurationMonths: number | null;
  applicationDeadline: Date | null;
  status: JobPostStatus;
  /** Linked Trade Assessment bank (M4) and AI Interview question set (M5). */
  tradeAssessmentId: string | null;
  aiInterviewQuestionSetId: string | null;
  /** Overrides platform default tier ranges when set. */
  tierThresholds: TierThresholds | null;
}

// ---------------------------------------------------------------------------
// Application (candidate ↔ job, with scoring) — SRS §3.4–3.6, §5.1
// ---------------------------------------------------------------------------
export interface Application extends BaseEntity {
  candidateId: string;
  jobPostId: string;
  stage: PipelineStage;
  appliedAt: Date;
  /** Stage 1 — Trade Assessment score (0–100). */
  assessmentScore: number | null;
  /** Stage 2 — AI Interview score (0–100). */
  interviewScore: number | null;
  /** Weighted final score = (assessment × W1) + (interview × W2). */
  finalScore: number | null;
  tier: CandidateTier;
  /** Required when an Admin overrides the computed tier (FR-TIER-002). */
  tierOverrideReason: string | null;
  /** Saudi client's signal on this candidate (FR-CLIENT-005). */
  clientInterest: ClientInterest | null;
  /** Internal admin-only notes (FR-ADMIN-005). */
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Post-selection lifecycle — SRS §3.10 FR-POST-001/002
// ---------------------------------------------------------------------------
export interface PostSelectionMilestone {
  stage: PostSelectionStage;
  /** One of the allowed values for `stage` (see POST_SELECTION_STAGE_STATUSES). */
  status: PostSelectionStatus;
  updatedBy: UserRole;
  updatedAt: Date | null;
  /** Supporting document (offer letter, visa copy, ticket, …) — FR-POST-003. */
  documentUrl: string | null;
  note: string | null;
}

export interface PostSelection extends BaseEntity {
  applicationId: string;
  candidateId: string;
  currentStage: PostSelectionStage;
  milestones: PostSelectionMilestone[];
}

// ---------------------------------------------------------------------------
// API contracts (Rule #2 — typed responses)
// ---------------------------------------------------------------------------
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Standard paginated list payload. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
