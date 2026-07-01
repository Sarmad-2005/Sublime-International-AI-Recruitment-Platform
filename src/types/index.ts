import type {
  CandidateTier,
  ClientInterest,
  Currency,
  DestinationCountry,
  EducationLevel,
  InterviewRecommendation,
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
  QuestionType,
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

// ---------------------------------------------------------------------------
// Trade Assessment — Stage 1 filter (SRS §3.4 M4)
// ---------------------------------------------------------------------------

/** One selectable answer option on a question (candidate-safe — no correctness). */
export interface AssessmentOptionDTO {
  id: string;
  text: string;
  imageUrl: string | null;
}

/**
 * A single question as sent to the candidate's browser. Deliberately omits
 * `correctAnswers` — scoring happens server-side only.
 */
export interface AssessmentQuestionDTO {
  id: string;
  type: QuestionType;
  questionText: string;
  imageUrl: string | null;
  points: number;
  options: AssessmentOptionDTO[];
}

/** Assessment configuration / rules shown on the instructions screen. */
export interface AssessmentConfigDTO {
  id: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  passingScore: number;
  totalQuestions: number;
  /** May the candidate navigate back to earlier questions? */
  allowPrevious: boolean;
  /** Auto-advance to the next question after an answer is selected? */
  autoAdvance: boolean;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  allowRetake: boolean;
  retakeCooldownDays: number;
}

/** Retake availability for a failed assessment. */
export interface RetakeStatus {
  /** Whether retakes are permitted at all for this assessment. */
  allowed: boolean;
  /** Whether the candidate may retake *right now*. */
  eligible: boolean;
  /** ISO timestamp the retake unlocks, or null if eligible/never. */
  availableAt: string | null;
  cooldownDays: number;
}

/** Summary of a candidate's attempt (for the entry screen). */
export interface AssessmentAttemptSummary {
  id: string;
  /** ISO timestamp. */
  startedAt: string;
  /** ISO timestamp, or null while still in progress. */
  submittedAt: string | null;
  score: number | null;
  passed: boolean;
  flaggedSuspicious: boolean;
}

/** Coarse state the assessment entry page branches on. */
export type AssessmentEntryState =
  | "ELIGIBLE" // fresh — may start
  | "IN_PROGRESS" // unsubmitted attempt exists — resume
  | "PASSED"
  | "FAILED_RETAKE" // failed and may retake now
  | "FAILED_COOLDOWN" // failed, retake locked until a future date
  | "FAILED_FINAL" // failed, no retake allowed
  | "NO_CV" // must submit a CV first
  | "NOT_CONFIGURED" // no active assessment for this job
  | "ALREADY_ADVANCED"; // application already past the assessment stage

/** Everything the assessment entry / instructions page renders. */
export interface AssessmentEntryDTO {
  applicationId: string;
  jobTitle: string;
  companyName: string;
  state: AssessmentEntryState;
  config: AssessmentConfigDTO | null;
  attempt: AssessmentAttemptSummary | null;
  retake: RetakeStatus | null;
}

/** The payload that drives the live assessment interface. */
export interface AssessmentTakeDTO {
  attemptId: string;
  /** ISO timestamp the attempt started. */
  startedAt: string;
  /** ISO timestamp the timer expires (startedAt + time limit). */
  endsAt: string;
  config: AssessmentConfigDTO;
  questions: AssessmentQuestionDTO[];
  tabSwitchCount: number;
}

/** Per-category (question-type) score breakdown on the result screen. */
export interface AssessmentCategoryBreakdown {
  category: QuestionType;
  label: string;
  correct: number;
  total: number;
  /** 0–100, rounded. */
  percentage: number;
}

/** Final scored result for the result screen. */
export interface AssessmentResultDTO {
  applicationId: string;
  jobTitle: string;
  companyName: string;
  /** 0–100, rounded. */
  score: number;
  passed: boolean;
  passingScore: number;
  /** ISO timestamp. */
  submittedAt: string;
  flaggedSuspicious: boolean;
  totalQuestions: number;
  correctCount: number;
  categories: AssessmentCategoryBreakdown[];
  /** Retake info when failed, else null. */
  retake: RetakeStatus | null;
}

/** Response of `POST /api/assessment/[id]/tab-switch`. */
export interface TabSwitchResult {
  count: number;
  /** True once the threshold is reached and the attempt must auto-submit. */
  autoSubmit: boolean;
}

/** Response of `POST /api/assessment/[id]/start`. */
export interface StartAttemptResult {
  attemptId: string;
  /** ISO timestamp. */
  startedAt: string;
  /** ISO timestamp the timer expires. */
  endsAt: string;
}

// ---------------------------------------------------------------------------
// AI Interview — Stage 2 (SRS §3.5 M5)
// ---------------------------------------------------------------------------

/** Lifecycle of an invite token as the entry screen branches on it. */
export type InterviewTokenState =
  | "VALID" // not started — ready to begin
  | "IN_PROGRESS" // started but not completed — resume
  | "COMPLETED" // already submitted
  | "EXPIRED" // past `inviteLinkExpiresAt`
  | "NOT_FOUND"; // no such token

/** A single AI-interview question, candidate-safe (no expected keywords). */
export interface InterviewQuestionDTO {
  id: string;
  order: number;
  questionText: string;
  questionType: string;
  /** Per-question answer window, seconds. */
  maxTimeSeconds: number;
}

/** What the entry / device-check screen needs (token-scoped, no auth). */
export interface InterviewEntryDTO {
  token: string;
  state: InterviewTokenState;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  questionCount: number;
  questionTimeLimitSeconds: number;
  maxDurationMinutes: number;
  /** ISO timestamp the link expires, or null. */
  expiresAt: string | null;
}

/** What the live session screen needs once the interview has started. */
export interface InterviewSessionDTO {
  token: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  /** AI interviewer's spoken introduction. */
  intro: string;
  questions: InterviewQuestionDTO[];
  questionTimeLimitSeconds: number;
  maxDurationMinutes: number;
}

/** Response of `POST /api/interview/[token]/identity`. */
export interface InterviewIdentityResult {
  identityPhotoUrl: string;
}

/** Response of `POST /api/interview/[token]/recording/chunk`. */
export interface InterviewChunkResult {
  chunkIndex: number;
  received: true;
}

/** Response of `POST /api/interview/[token]/recording/finalize`. */
export interface InterviewFinalizeResult {
  recordingUrl: string | null;
}

/** Response of `POST /api/interview/[token]/follow-up`. */
export interface InterviewFollowUpResult {
  /** Null when the model decides a follow-up isn't warranted. */
  followUp: string | null;
}

/** The five 0–100 sub-scores + qualitative analysis Gemini returns. */
export interface InterviewScores {
  technicalScore: number;
  communicationScore: number;
  behavioralScore: number;
  confidenceScore: number;
  overallInterviewScore: number;
  strengths: string[];
  improvements: string[];
  aiSummary: string;
  recommendation: InterviewRecommendation;
}

/** Tiering outcome surfaced after the interview is scored. */
export interface TierRecordDTO {
  tier: CandidateTier;
  finalScore: number;
  assessmentScore: number | null;
  interviewScore: number | null;
  assessmentWeight: number;
  interviewWeight: number;
}

/** Response of `POST /api/interview/[token]/score` (completion + tiering). */
export interface InterviewScoreResult {
  scores: InterviewScores;
  tier: TierRecordDTO;
}

// ---------------------------------------------------------------------------
// Admin dashboard (SRS §3.7 M12 — staff overview & analytics)
// ---------------------------------------------------------------------------

/**
 * A single headline metric: the current value plus the percent change versus the
 * comparable previous period. `change` is `null` when a meaningful comparison
 * isn't possible (e.g. the previous period had zero activity).
 */
export interface DashboardMetric {
  value: number;
  /** Signed percent change vs the previous period, rounded, or `null`. */
  change: number | null;
}

/** The four headline cards on the admin dashboard. */
export interface DashboardMetrics {
  /** Job posts currently ACTIVE. Change = posts published this vs last month. */
  activeJobPosts: DashboardMetric;
  /** Applications in an active (non-terminal) pipeline state. */
  candidatesInPipeline: DashboardMetric;
  /** Applications that reached a shortlisted state this calendar month. */
  shortlistedThisMonth: DashboardMetric;
  /** Candidates deployed this calendar year. */
  placementsThisYear: DashboardMetric;
}

/** One stage of the recruitment funnel (cumulative — reached at-or-past stage). */
export interface PipelineStageCount {
  stage: PipelineStage;
  label: string;
  count: number;
}

/** Ordered funnel from Applied → Post-Selection. */
export type PipelineCounts = PipelineStageCount[];

/** One slice of the tier-distribution pie. */
export interface TierDistributionItem {
  tier: CandidateTier;
  label: string;
  count: number;
}

/** Diamond / Platinum / Gold / Bronze / Pending breakdown. */
export type TierDistribution = TierDistributionItem[];

/**
 * One entry in the admin recent-activity feed, derived from an `AuditLog` row.
 * JSON-safe so it flows from the Server Component to the realtime client feed.
 */
export interface ActivityItem {
  id: string;
  /** Human-readable, pre-formatted message. */
  message: string;
  /** Deep link to the related record, or `null`. */
  href: string | null;
  /** ISO timestamp of the event. */
  timestamp: string;
}

/** A row in the "Top Job Posts" table on the dashboard. */
export interface TopJobPost {
  id: string;
  title: string;
  companyName: string;
  /** Total applications received. */
  applicants: number;
  /** Applications that reached a shortlisted state. */
  shortlisted: number;
  /** ISO timestamp or null. */
  deadline: string | null;
  status: JobPostStatus;
}

// ---------------------------------------------------------------------------
// Admin Candidate Management — SRS §3.7 M12
// ---------------------------------------------------------------------------

export interface AdminCandidateListItem {
  applicationId: string;
  candidateId: string;
  fullName: string;
  profilePhotoUrl: string | null;
  jobTitle: string;
  jobPostId: string;
  companyName: string;
  /** ISO timestamp. */
  appliedAt: string;
  status: ApplicationStatus;
  tier: CandidateTier;
  assessmentScore: number | null;
  /** null when no attempt exists yet. */
  assessmentPassed: boolean | null;
  interviewScore: number | null;
  finalScore: number | null;
  flaggedSuspicious: boolean;
}

export type AdminCandidateFilters = {
  q: string | null;
  jobPostId: string | null;
  statuses: ApplicationStatus[];
  tiers: CandidateTier[];
  /** null = no filter; true/false = filter by outcome. */
  assessmentPassed: boolean | null;
  /** ISO date string or null. */
  dateFrom: string | null;
  dateTo: string | null;
};

export type PaginatedCandidates = Paginated<AdminCandidateListItem>;

export interface AdminCandidateNote {
  id: string;
  note: string;
  adminId: string | null;
  /** ISO timestamp. */
  createdAt: string;
}

export interface SaudiClientSummary {
  id: string;
  companyName: string;
  city: string;
  logoUrl: string | null;
}

export interface JobPostSummary {
  id: string;
  title: string;
}

export interface AdminAssessmentDetail {
  score: number | null;
  passed: boolean;
  flaggedSuspicious: boolean;
  tabSwitchCount: number;
  submittedAt: string | null;
}

export interface AdminInterviewDetail {
  status: string;
  overallScore: number | null;
  technicalScore: number | null;
  communicationScore: number | null;
  behavioralScore: number | null;
  confidenceScore: number | null;
  aiSummary: string | null;
  recordingUrl: string | null;
  completedAt: string | null;
}

export interface AdminTierRecord {
  tier: CandidateTier;
  finalScore: number | null;
  assessmentScore: number | null;
  interviewScore: number | null;
  assessmentWeight: number;
  interviewWeight: number;
  adminOverride: boolean;
  adminOverrideNote: string | null;
  assignedAt: string | null;
}

export interface AdminApplicationSummary {
  id: string;
  jobPostId: string;
  jobTitle: string;
  companyName: string;
  status: ApplicationStatus;
  appliedAt: string;
  tier: CandidateTier;
  finalScore: number | null;
  assessment: AdminAssessmentDetail | null;
  interview: AdminInterviewDetail | null;
  tierRecord: AdminTierRecord | null;
  postSelection: {
    offerLetterStatus: string;
    gamcaStatus: string;
    visaStatus: string;
    ticketArrangement: string;
    preDepartureBriefStatus: string;
    arrivalStatus: string;
    probationStatus: string;
  } | null;
}

export interface AdminCandidateDetailView {
  candidate: CandidateProfileDTO;
  userEmail: string;
  userPhone: string | null;
  applications: AdminApplicationSummary[];
  notes: AdminCandidateNote[];
}
