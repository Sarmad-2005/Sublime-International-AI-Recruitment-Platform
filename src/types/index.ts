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

// ---------------------------------------------------------------------------
// Candidate portal — profile DTO & dashboard (SRS §3.3, §3.7)
// ---------------------------------------------------------------------------
import type {
  ApplicationStatus,
  EducationLevel as PrismaEducationLevel,
  Gender as PrismaGender,
  MaritalStatus as PrismaMaritalStatus,
} from "@/generated/prisma/enums";

/**
 * JSON-safe candidate profile returned by the candidate service and the
 * `/api/candidate/profile` endpoint. All `Date` columns are serialised to
 * `yyyy-MM-dd` strings so the payload survives the server → client boundary and
 * binds directly to `<input type="date">`.
 */
export interface CandidateProfileDTO {
  id: string;
  userId: string;

  // Personal identity (BEOE).
  fullName: string;
  fatherName: string;
  cnic: string;
  /** ISO date `yyyy-MM-dd`. */
  dateOfBirth: string;
  gender: PrismaGender;
  nationality: string;
  maritalStatus: PrismaMaritalStatus | null;
  religion: string | null;

  // Passport.
  passportNumber: string | null;
  passportIssueDate: string | null;
  passportExpiryDate: string | null;
  passportIssuePlace: string | null;

  // Address.
  permanentAddress: string;
  currentAddress: string | null;
  city: string;
  province: string | null;
  country: string;
  postalCode: string | null;

  // Education & trade.
  educationLevel: PrismaEducationLevel;
  primaryTrade: string;
  secondaryTrade: string | null;
  yearsOfExperience: number;

  // Media / documents.
  profilePhotoUrl: string | null;
  cvUrl: string | null;
  cvUploadedAt: string | null;
  passportCopyUrl: string | null;

  // Emergency contact.
  emergencyContactName: string | null;
  emergencyContactRelation: string | null;
  emergencyContactPhone: string | null;
  emergencyContactAddress: string | null;
}

/** A single section's completion state (used for per-tab progress). */
export interface SectionCompletion {
  /** 0–100, rounded. */
  percentage: number;
  /** Human-readable labels of the fields still missing in this section. */
  missingFields: string[];
}

/** Per-section + overall profile completion, surfaced by the profile page. */
export interface ProfileCompletion {
  overall: number;
  sections: {
    personal: SectionCompletion;
    documents: SectionCompletion;
    education: SectionCompletion;
  };
  /** Flat list of every missing field across all sections. */
  missingFields: string[];
}

/** The five candidate-facing pipeline buckets shown as dashboard stat cards. */
export type CandidateStatusBucket =
  | "APPLIED"
  | "ASSESSMENT_PENDING"
  | "INTERVIEW_PENDING"
  | "SHORTLISTED"
  | "SELECTED";

/** One row in the candidate's recent-activity timeline. */
export interface CandidateActivityItem {
  id: string;
  jobTitle: string;
  status: ApplicationStatus;
  /** ISO timestamp of the status change. */
  occurredAt: string;
}

/** A candidate's application summarised for portal lists. */
export interface CandidateApplicationSummary {
  id: string;
  jobPostId: string;
  jobTitle: string;
  companyName: string;
  city: string | null;
  status: ApplicationStatus;
  /** ISO timestamp. */
  appliedAt: string;
}

/** A featured job the candidate has not yet applied to. */
export interface FeaturedJob {
  id: string;
  title: string;
  companyName: string;
  sector: string;
  city: string | null;
  country: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  vacancies: number;
  /** ISO timestamp or null. */
  deadline: string | null;
}

/** A notification surfaced in the candidate nav bell dropdown. */
export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  /** ISO timestamp. */
  createdAt: string;
}

/** Bell payload: recent notifications plus the unread badge count. */
export interface NotificationFeed {
  items: NotificationDTO[];
  unreadCount: number;
}

/** Everything the candidate dashboard server component renders. */
export interface CandidateDashboardData {
  fullName: string;
  profilePhotoUrl: string | null;
  completion: ProfileCompletion;
  /** Count of applications in each status bucket. */
  statusCounts: Record<CandidateStatusBucket, number>;
  totalApplications: number;
  recentActivity: CandidateActivityItem[];
  featuredJobs: FeaturedJob[];
  unreadNotifications: number;
}

// ---------------------------------------------------------------------------
// Job board & job detail (SRS §3.2 M2 — candidate-facing reads)
// ---------------------------------------------------------------------------

/** One job card on the candidate Job Board. JSON-safe (dates as ISO strings). */
export interface JobBoardItem {
  id: string;
  title: string;
  companyName: string;
  /** Raw sector enum value (label resolved client-side via JOB_SECTOR_LABELS). */
  sector: string;
  city: string | null;
  country: string;
  /** Salary in whole major units (SAR), already converted from halalas. */
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  vacancies: number;
  /** ISO timestamp or null. */
  deadline: string | null;
  /** ISO timestamp the job went live, or null. */
  publishedAt: string | null;
}

/** Parsed, validated Job Board query (from URL searchParams). */
export interface JobBoardQuery {
  search: string | null;
  sector: string | null;
  country: string | null;
  /** Minimum monthly salary (major units) the job must reach. */
  salaryMin: number | null;
  /** Only jobs published within the last N days (null = any time). */
  postedWithinDays: number | null;
  page: number;
}

/** Paginated Job Board payload returned by the service and `/api/jobs`. */
export interface JobBoardResult {
  items: JobBoardItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Distinct destination countries across all active jobs (filter facet). */
  countries: string[];
}

/** Which standard benefits a job advertises (parsed from its benefits text). */
export interface JobBenefitFlags {
  accommodation: boolean;
  medical: boolean;
  transport: boolean;
  food: boolean;
}

/** Full job detail for the candidate-facing job page. */
export interface JobDetailDTO {
  id: string;
  title: string;
  companyName: string;
  sector: string;
  description: string | null;
  /** Free-text requirements/qualifications, split into bullet lines. */
  requirements: string[];
  /** Raw benefits text (verbatim) and the parsed standard-benefit flags. */
  benefitsText: string | null;
  benefitFlags: JobBenefitFlags;
  city: string | null;
  country: string;
  vacancies: number;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  contractDurationMonths: number | null;
  deadline: string | null;
  publishedAt: string | null;
  status: string;
  /** True once the deadline has passed (applications closed). */
  isExpired: boolean;
}

// ---------------------------------------------------------------------------
// Applications (SRS §3.4 M3 — candidate-facing reads/writes)
// ---------------------------------------------------------------------------

/** A single application row for the "My Applications" list. */
export interface ApplicationListItem {
  id: string;
  jobPostId: string;
  jobTitle: string;
  companyName: string;
  city: string | null;
  status: ApplicationStatus;
  /** Assigned tier, or null while still PENDING/unscored. */
  tier: CandidateTier | null;
  /** ISO timestamp. */
  appliedAt: string;
}

/** Stage-1 trade-assessment outcome on an application. */
export interface ApplicationAssessmentResult {
  score: number | null;
  passed: boolean;
  /** ISO timestamp the attempt was submitted, or null if not finished. */
  submittedAt: string | null;
}

/** Stage-2 AI-interview outcome on an application. */
export interface ApplicationInterviewResult {
  overallScore: number | null;
  tier: CandidateTier | null;
  aiSummary: string | null;
  /** ISO timestamp the interview completed, or null. */
  completedAt: string | null;
}

/** One milestone in the post-selection deployment tracker. */
export interface ApplicationPostSelectionMilestone {
  stage: PostSelectionStage;
  label: string;
  /** Current status value for this milestone (or null if not started). */
  status: string | null;
  done: boolean;
}

/** Post-selection deployment progress for a selected candidate. */
export interface ApplicationPostSelection {
  milestones: ApplicationPostSelectionMilestone[];
  /** 0–100 overall deployment progress. */
  progress: number;
}

/** One entry in an application's history timeline. */
export interface ApplicationTimelineItem {
  id: string;
  title: string;
  description: string | null;
  /** ISO timestamp, or null for an upcoming (not-yet-reached) step. */
  date: string | null;
  state: "done" | "current" | "upcoming";
}

/** Everything the application detail page renders. */
export interface ApplicationDetailDTO {
  id: string;
  jobPostId: string;
  jobTitle: string;
  companyName: string;
  sector: string;
  city: string | null;
  country: string;
  status: ApplicationStatus;
  cvUrl: string | null;
  tier: CandidateTier | null;
  finalScore: number | null;
  /** ISO timestamp. */
  appliedAt: string;
  assessment: ApplicationAssessmentResult | null;
  interview: ApplicationInterviewResult | null;
  postSelection: ApplicationPostSelection | null;
  timeline: ApplicationTimelineItem[];
}
