/**
 * App-wide constants for SIORP — reconciled against the SRS
 * (SRS-SIORP-2026-001 v1.0). FR/section references are cited inline for
 * traceability.
 *
 * Implemented as `as const` objects + derived union types rather than TS
 * `enum`s: erasable (works with `isolatedModules`), tree-shakeable, and they
 * compose directly with Zod (`z.enum(<VALUES>)`) so the same source of truth is
 * shared between the database, API and forms (Rules #1 & #6).
 */

// ---------------------------------------------------------------------------
// User roles — SRS §2.3 / §5.2
// ---------------------------------------------------------------------------
export const USER_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  SAUDI_CLIENT: "SAUDI_CLIENT",
  CANDIDATE: "CANDIDATE",
  MEDICAL_OFFICER: "MEDICAL_OFFICER",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export const USER_ROLE_VALUES = Object.values(USER_ROLES) as UserRole[];

/** Runtime type guard for the `UserRole` union (narrows `unknown` values). */
export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && (USER_ROLE_VALUES as string[]).includes(value)
  );
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin / Recruiter",
  SAUDI_CLIENT: "Saudi Client",
  CANDIDATE: "Candidate",
  MEDICAL_OFFICER: "Medical Officer",
};

/** Session inactivity timeout per role family — SRS §3.1.3 FR-AUTH-012. */
export const SESSION_TIMEOUT_HOURS = {
  CANDIDATE: 24,
  STAFF: 8, // Admin / Super Admin / Saudi Client / Medical Officer
} as const;

// ---------------------------------------------------------------------------
// Candidate tiers — SRS §3.6 FR-TIER-001
// ---------------------------------------------------------------------------
export const CANDIDATE_TIERS = {
  DIAMOND: "DIAMOND",
  PLATINUM: "PLATINUM",
  GOLD: "GOLD",
  BRONZE: "BRONZE",
  REJECTED: "REJECTED",
  PENDING: "PENDING",
} as const;

export type CandidateTier = (typeof CANDIDATE_TIERS)[keyof typeof CANDIDATE_TIERS];
export const CANDIDATE_TIER_VALUES = Object.values(CANDIDATE_TIERS) as CandidateTier[];

export const CANDIDATE_TIER_LABELS: Record<CandidateTier, string> = {
  DIAMOND: "Diamond",
  PLATINUM: "Platinum",
  GOLD: "Gold",
  BRONZE: "Bronze",
  REJECTED: "Rejected",
  PENDING: "Pending",
};

/** Tier badges — SRS §3.6 FR-TIER-001. */
export const CANDIDATE_TIER_BADGES: Record<CandidateTier, string> = {
  DIAMOND: "💎",
  PLATINUM: "🏆",
  GOLD: "🥇",
  BRONZE: "🥉",
  REJECTED: "✗",
  PENDING: "⏳",
};

/**
 * Default tier score ranges (inclusive) — SRS §3.6 FR-TIER-001.
 * `PENDING` has no score (assessment/interview not completed). These are the
 * platform defaults; per-job "Classification Thresholds" (FR-JOB-002) override.
 */
export type ScoredTier = Exclude<CandidateTier, "PENDING">;
export const TIER_SCORE_RANGES: Record<ScoredTier, { min: number; max: number }> = {
  DIAMOND: { min: 90, max: 100 },
  PLATINUM: { min: 75, max: 89 },
  GOLD: { min: 60, max: 74 },
  BRONZE: { min: 45, max: 59 },
  REJECTED: { min: 0, max: 44 },
};

// ---------------------------------------------------------------------------
// Scoring weights — SRS §3.5.3 FR-AI-010 / Appendix A
// Final Score = (Stage 1 × W1) + (Stage 2 × W2), constraint W1 + W2 = 1.0.
// ---------------------------------------------------------------------------
export const DEFAULT_SCORING_WEIGHTS = {
  stage1Assessment: 0.35,
  stage2Interview: 0.65,
} as const;

// ---------------------------------------------------------------------------
// Recruitment pipeline (top-level stages) — SRS §3.7.1 FR-ADMIN-001
// ---------------------------------------------------------------------------
export const PIPELINE_STAGES = {
  APPLIED: "APPLIED",
  ASSESSMENT: "ASSESSMENT", // Stage 1 — Trade Assessment (M4)
  INTERVIEW: "INTERVIEW", // Stage 2 — AI Interview (M5)
  SHORTLISTED: "SHORTLISTED",
  SELECTED: "SELECTED",
  POST_SELECTION: "POST_SELECTION",
} as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[keyof typeof PIPELINE_STAGES];
export const PIPELINE_STAGE_VALUES = Object.values(PIPELINE_STAGES) as PipelineStage[];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  APPLIED: "Applied",
  ASSESSMENT: "Assessment (Stage 1)",
  INTERVIEW: "AI Interview (Stage 2)",
  SHORTLISTED: "Shortlisted",
  SELECTED: "Selected",
  POST_SELECTION: "Post-Selection",
};

/** Ordered list for rendering the main pipeline funnel left-to-right. */
export const PIPELINE_STAGE_ORDER: PipelineStage[] = [
  PIPELINE_STAGES.APPLIED,
  PIPELINE_STAGES.ASSESSMENT,
  PIPELINE_STAGES.INTERVIEW,
  PIPELINE_STAGES.SHORTLISTED,
  PIPELINE_STAGES.SELECTED,
  PIPELINE_STAGES.POST_SELECTION,
];

// ---------------------------------------------------------------------------
// Post-selection lifecycle (8 sequential stages) — SRS §3.10 FR-POST-002
// ---------------------------------------------------------------------------
export const POST_SELECTION_STAGES = {
  OFFER_LETTER: "OFFER_LETTER",
  GAMCA_MEDICAL: "GAMCA_MEDICAL",
  VISA_APPLICATION: "VISA_APPLICATION",
  FLIGHT_TICKET: "FLIGHT_TICKET",
  PRE_DEPARTURE_BRIEF: "PRE_DEPARTURE_BRIEF",
  DEPARTURE: "DEPARTURE",
  ARRIVAL_IN_KSA: "ARRIVAL_IN_KSA",
  PROBATION_STATUS: "PROBATION_STATUS",
} as const;

export type PostSelectionStage =
  (typeof POST_SELECTION_STAGES)[keyof typeof POST_SELECTION_STAGES];
export const POST_SELECTION_STAGE_VALUES = Object.values(
  POST_SELECTION_STAGES,
) as PostSelectionStage[];

export const POST_SELECTION_STAGE_LABELS: Record<PostSelectionStage, string> = {
  OFFER_LETTER: "Offer Letter",
  GAMCA_MEDICAL: "GAMCA Medical",
  VISA_APPLICATION: "Visa Application",
  FLIGHT_TICKET: "Flight Ticket",
  PRE_DEPARTURE_BRIEF: "Pre-Departure Brief",
  DEPARTURE: "Departure",
  ARRIVAL_IN_KSA: "Arrival in KSA",
  PROBATION_STATUS: "Probation Status",
};

/** Sequential order of post-selection milestones — SRS §3.10 FR-POST-002. */
export const POST_SELECTION_STAGE_ORDER: PostSelectionStage[] = [
  POST_SELECTION_STAGES.OFFER_LETTER,
  POST_SELECTION_STAGES.GAMCA_MEDICAL,
  POST_SELECTION_STAGES.VISA_APPLICATION,
  POST_SELECTION_STAGES.FLIGHT_TICKET,
  POST_SELECTION_STAGES.PRE_DEPARTURE_BRIEF,
  POST_SELECTION_STAGES.DEPARTURE,
  POST_SELECTION_STAGES.ARRIVAL_IN_KSA,
  POST_SELECTION_STAGES.PROBATION_STATUS,
];

/** Which role updates each milestone — SRS §3.10 FR-POST-002 ("Updated By"). */
export const POST_SELECTION_STAGE_UPDATED_BY: Record<PostSelectionStage, UserRole> = {
  OFFER_LETTER: "ADMIN",
  GAMCA_MEDICAL: "MEDICAL_OFFICER",
  VISA_APPLICATION: "ADMIN",
  FLIGHT_TICKET: "ADMIN",
  PRE_DEPARTURE_BRIEF: "ADMIN",
  DEPARTURE: "ADMIN",
  ARRIVAL_IN_KSA: "ADMIN",
  PROBATION_STATUS: "ADMIN",
};

/** Allowed status values per milestone — SRS §3.10 FR-POST-002. */
export const POST_SELECTION_STAGE_STATUSES = {
  OFFER_LETTER: ["PENDING", "ISSUED", "SIGNED_BY_CANDIDATE"],
  GAMCA_MEDICAL: ["SCHEDULED", "COMPLETED_FIT", "COMPLETED_UNFIT", "EXEMPTED"],
  VISA_APPLICATION: ["NOT_STARTED", "IN_PROGRESS", "VISA_STAMPED", "REJECTED"],
  FLIGHT_TICKET: ["ARRANGED_BY_EMPLOYER", "REQUESTED_FROM_CANDIDATE", "ISSUED"],
  PRE_DEPARTURE_BRIEF: ["SCHEDULED", "COMPLETED"],
  DEPARTURE: ["PENDING", "DEPARTED"],
  ARRIVAL_IN_KSA: ["PENDING", "ARRIVED", "CONFIRMED_BY_EMPLOYER"],
  PROBATION_STATUS: ["IN_PROGRESS", "PASSED", "FAILED", "EARLY_RETURN"],
} as const;

/** Union of every post-selection status value across all milestones. */
export type PostSelectionStatus =
  (typeof POST_SELECTION_STAGE_STATUSES)[PostSelectionStage][number];

// ---------------------------------------------------------------------------
// Saudi client interest signal — SRS §3.8 FR-CLIENT-005
// ---------------------------------------------------------------------------
export const CLIENT_INTEREST = {
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  SHORTLISTED_FOR_LIVE_INTERVIEW: "SHORTLISTED_FOR_LIVE_INTERVIEW",
} as const;

export type ClientInterest = (typeof CLIENT_INTEREST)[keyof typeof CLIENT_INTEREST];
export const CLIENT_INTEREST_VALUES = Object.values(CLIENT_INTEREST) as ClientInterest[];

// ---------------------------------------------------------------------------
// Job post status — SRS §3.2.1 FR-JOB-003
// ---------------------------------------------------------------------------
export const JOB_POST_STATUSES = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
  FILLED: "FILLED",
} as const;

export type JobPostStatus = (typeof JOB_POST_STATUSES)[keyof typeof JOB_POST_STATUSES];
export const JOB_POST_STATUS_VALUES = Object.values(JOB_POST_STATUSES) as JobPostStatus[];

// ---------------------------------------------------------------------------
// Job sectors (Phase 1) — SRS §2.7 "Target Sectors — Phase 1"
// ---------------------------------------------------------------------------
export const JOB_SECTORS = {
  CONSTRUCTION: "CONSTRUCTION", // Construction & Civil Engineering
  HEALTHCARE_SUPPORT: "HEALTHCARE_SUPPORT",
  NURSING: "NURSING",
  MEDICAL_PROFESSIONALS: "MEDICAL_PROFESSIONALS",
  DATA_TECHNOLOGY: "DATA_TECHNOLOGY",
} as const;

export type JobSector = (typeof JOB_SECTORS)[keyof typeof JOB_SECTORS];

/** Array of all Phase 1 sectors. */
export const JOB_SECTOR_VALUES = Object.values(JOB_SECTORS) as JobSector[];

export const JOB_SECTOR_LABELS: Record<JobSector, string> = {
  CONSTRUCTION: "Construction & Civil Engineering",
  HEALTHCARE_SUPPORT: "Healthcare Support",
  NURSING: "Nursing",
  MEDICAL_PROFESSIONALS: "Medical Professionals",
  DATA_TECHNOLOGY: "Data & Technology",
};

// ---------------------------------------------------------------------------
// Education levels — SRS §3.3.1 FR-CAND-001
// ---------------------------------------------------------------------------
export const EDUCATION_LEVELS = {
  MATRIC: "MATRIC",
  INTERMEDIATE: "INTERMEDIATE",
  DIPLOMA: "DIPLOMA",
  BACHELORS: "BACHELORS",
  MASTERS: "MASTERS",
  MBBS: "MBBS",
  OTHER: "OTHER",
} as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[keyof typeof EDUCATION_LEVELS];
export const EDUCATION_LEVEL_VALUES = Object.values(EDUCATION_LEVELS) as EducationLevel[];

// ---------------------------------------------------------------------------
// Destination countries & currencies — SRS §3.2.1 FR-JOB-002 / §4.4 NFR-SCALE-002
// Phase 1 is active for Saudi Arabia / SAR; the rest are schema-ready for later.
// ---------------------------------------------------------------------------
export const DESTINATION_COUNTRIES = {
  SAUDI_ARABIA: "SAUDI_ARABIA",
  UAE: "UAE",
  KUWAIT: "KUWAIT",
  QATAR: "QATAR",
} as const;

export type DestinationCountry =
  (typeof DESTINATION_COUNTRIES)[keyof typeof DESTINATION_COUNTRIES];
export const DESTINATION_COUNTRY_VALUES = Object.values(
  DESTINATION_COUNTRIES,
) as DestinationCountry[];
export const DEFAULT_DESTINATION_COUNTRY: DestinationCountry =
  DESTINATION_COUNTRIES.SAUDI_ARABIA;

export const CURRENCIES = {
  SAR: "SAR",
  AED: "AED",
  EUR: "EUR",
} as const;

export type Currency = (typeof CURRENCIES)[keyof typeof CURRENCIES];
export const CURRENCY_VALUES = Object.values(CURRENCIES) as Currency[];
export const DEFAULT_CURRENCY: Currency = CURRENCIES.SAR;

// ---------------------------------------------------------------------------
// Upload constraints — SRS §3.3.2 FR-CAND-002 / §3.3.1 FR-CAND-001
// ---------------------------------------------------------------------------
export const UPLOAD_LIMITS = {
  CV_MAX_BYTES: 5 * 1024 * 1024, // 5 MB
  CV_ACCEPTED_TYPES: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  PHOTO_ACCEPTED_TYPES: ["image/jpeg", "image/png"],
  PHOTO_MIN_DIMENSION_PX: 300,
} as const;

// ---------------------------------------------------------------------------
// Route prefixes (used by middleware for role-based protection)
// ---------------------------------------------------------------------------
export const ROUTES = {
  HOME: "/",

  // Auth pages (grouped under /auth/*).
  AUTH: "/auth",
  LOGIN: "/auth/login",
  REGISTER: "/auth/register",
  FORGOT_PASSWORD: "/auth/forgot-password",
  RESET_PASSWORD: "/auth/reset-password",
  VERIFY_OTP: "/auth/verify-otp",

  // Portal roots (one per role family).
  ADMIN: "/admin",
  CLIENT: "/client",
  CANDIDATE: "/candidate",
  MEDICAL: "/medical",

  // Role landing dashboards.
  ADMIN_DASHBOARD: "/admin/dashboard",
  CLIENT_DASHBOARD: "/client/dashboard",
  CANDIDATE_DASHBOARD: "/candidate/dashboard",
  MEDICAL_DASHBOARD: "/medical/dashboard",
} as const;

/** Where each role lands after authentication (role dashboards). */
export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  SUPER_ADMIN: ROUTES.ADMIN_DASHBOARD,
  ADMIN: ROUTES.ADMIN_DASHBOARD,
  SAUDI_CLIENT: ROUTES.CLIENT_DASHBOARD,
  CANDIDATE: ROUTES.CANDIDATE_DASHBOARD,
  MEDICAL_OFFICER: ROUTES.MEDICAL_DASHBOARD,
};

/**
 * Query-string key carrying the path a user was bounced from, so the login page
 * can return them after authenticating: `/auth/login?redirect=/admin/...`.
 */
export const AUTH_REDIRECT_PARAM = "redirect";

/**
 * Request headers the middleware injects after resolving the session, so
 * downstream Server Components, Route Handlers and Server Actions can read the
 * caller's identity without re-decoding the session cookie.
 */
export const AUTH_HEADERS = {
  USER_ID: "x-user-id",
  USER_ROLE: "x-user-role",
} as const;

// ---------------------------------------------------------------------------
// Candidate profile option labels — keyed by the generated Prisma enums so the
// dropdowns, API and database all share one source of truth (SRS §3.3.1).
// ---------------------------------------------------------------------------
export const GENDER_OPTIONS = ["MALE", "FEMALE", "OTHER"] as const;
export const GENDER_LABELS: Record<(typeof GENDER_OPTIONS)[number], string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

export const MARITAL_STATUS_OPTIONS = [
  "SINGLE",
  "MARRIED",
  "DIVORCED",
  "WIDOWED",
] as const;
export const MARITAL_STATUS_LABELS: Record<
  (typeof MARITAL_STATUS_OPTIONS)[number],
  string
> = {
  SINGLE: "Single",
  MARRIED: "Married",
  DIVORCED: "Divorced",
  WIDOWED: "Widowed",
};

/** Ordered low → high, matching the Prisma `EducationLevel` enum. */
export const EDUCATION_LEVEL_OPTIONS = [
  "NONE",
  "PRIMARY",
  "MIDDLE",
  "MATRIC",
  "INTERMEDIATE",
  "DIPLOMA",
  "BACHELORS",
  "MASTERS",
  "DOCTORATE",
] as const;
export const EDUCATION_LEVEL_LABELS: Record<
  (typeof EDUCATION_LEVEL_OPTIONS)[number],
  string
> = {
  NONE: "No formal education",
  PRIMARY: "Primary",
  MIDDLE: "Middle",
  MATRIC: "Matriculation",
  INTERMEDIATE: "Intermediate",
  DIPLOMA: "Diploma",
  BACHELORS: "Bachelor's",
  MASTERS: "Master's",
  DOCTORATE: "Doctorate",
};

/** Common emergency-contact relations offered in the dropdown. */
export const EMERGENCY_RELATIONS = [
  "Father",
  "Mother",
  "Spouse",
  "Brother",
  "Sister",
  "Son",
  "Daughter",
  "Guardian",
  "Other",
] as const;

/** Common trades for the corridor — power the trade input datalists. */
export const COMMON_TRADES = [
  "Electrician",
  "Plumber",
  "Welder",
  "Mason",
  "Carpenter",
  "Steel Fixer",
  "Heavy Driver",
  "Light Driver",
  "Crane Operator",
  "HVAC Technician",
  "Auto Mechanic",
  "Painter",
  "Scaffolder",
  "Caregiver",
  "Nurse",
  "Lab Technician",
  "Chef / Cook",
  "Housekeeping",
  "Security Guard",
  "IT Support",
] as const;

// ---------------------------------------------------------------------------
// Candidate dashboard status buckets — collapse the detailed ApplicationStatus
// pipeline into the five stages a candidate sees (SRS §3.7.1).
// ---------------------------------------------------------------------------
export const CANDIDATE_STATUS_BUCKETS = [
  "APPLIED",
  "ASSESSMENT_PENDING",
  "INTERVIEW_PENDING",
  "SHORTLISTED",
  "SELECTED",
] as const;

export type CandidateStatusBucket = (typeof CANDIDATE_STATUS_BUCKETS)[number];

export const CANDIDATE_STATUS_BUCKET_LABELS: Record<
  CandidateStatusBucket,
  string
> = {
  APPLIED: "Applied",
  ASSESSMENT_PENDING: "Assessment Pending",
  INTERVIEW_PENDING: "Interview Pending",
  SHORTLISTED: "Shortlisted",
  SELECTED: "Selected",
};

/**
 * Map a detailed `ApplicationStatus` (the DB enum) to the candidate-facing
 * bucket. Terminal states (REJECTED / WITHDRAWN / DEPLOYED) return `null` and
 * are excluded from the active stat cards.
 */
export const APPLICATION_STATUS_TO_BUCKET: Record<
  string,
  CandidateStatusBucket | null
> = {
  APPLIED: "APPLIED",
  ASSESSMENT_PENDING: "ASSESSMENT_PENDING",
  ASSESSMENT_FAILED: "ASSESSMENT_PENDING",
  ASSESSMENT_PASSED: "INTERVIEW_PENDING",
  INTERVIEW_INVITED: "INTERVIEW_PENDING",
  INTERVIEW_IN_PROGRESS: "INTERVIEW_PENDING",
  INTERVIEW_COMPLETED: "INTERVIEW_PENDING",
  TIERED: "SHORTLISTED",
  IN_CLIENT_POOL: "SHORTLISTED",
  CLIENT_SHORTLISTED: "SHORTLISTED",
  LIVE_INTERVIEW_SCHEDULED: "SHORTLISTED",
  SELECTED: "SELECTED",
  POST_SELECTION: "SELECTED",
  DEPLOYED: null,
  REJECTED: null,
  WITHDRAWN: null,
};

/** Plain-English labels for each detailed application status (timeline copy). */
export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  APPLIED: "Application submitted",
  ASSESSMENT_PENDING: "Assessment pending",
  ASSESSMENT_PASSED: "Assessment passed",
  ASSESSMENT_FAILED: "Assessment not passed",
  INTERVIEW_INVITED: "Invited to AI interview",
  INTERVIEW_IN_PROGRESS: "AI interview in progress",
  INTERVIEW_COMPLETED: "AI interview completed",
  TIERED: "Tier assigned",
  IN_CLIENT_POOL: "Shared with employer",
  CLIENT_SHORTLISTED: "Shortlisted by employer",
  LIVE_INTERVIEW_SCHEDULED: "Live interview scheduled",
  SELECTED: "Selected",
  POST_SELECTION: "Deployment in progress",
  DEPLOYED: "Deployed",
  REJECTED: "Not selected",
  WITHDRAWN: "Application withdrawn",
};

// ---------------------------------------------------------------------------
// Trade Assessment — Stage 1 filter (SRS §3.4 M4)
// ---------------------------------------------------------------------------
/**
 * Tab-switches tolerated before an attempt is auto-submitted and flagged as
 * suspicious (anti-cheating, SRS §3.4). The Nth switch triggers the submit.
 */
export const ASSESSMENT_TAB_SWITCH_LIMIT = 3;

/**
 * Behaviour toggles not (yet) persisted on `TradeAssessment`. Surfaced through
 * the assessment config so the UI already supports them; promote to DB columns
 * when per-assessment overrides are needed.
 */
export const ASSESSMENT_DEFAULTS = {
  /** Allow navigating back to earlier questions. */
  allowPrevious: true,
  /** Auto-advance to the next question after selecting an answer. */
  autoAdvance: false,
} as const;

/** Human labels for the question types (used in the result breakdown). */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ: "Multiple choice",
  MULTI_SELECT: "Multi-select",
  SCENARIO: "Scenario",
  IMAGE_BASED: "Image-based",
};

// ---------------------------------------------------------------------------
// AI Interview — Stage 2 (SRS §3.5 M5)
// ---------------------------------------------------------------------------
/** Validity window of an AI-interview invite link, in hours. */
export const AI_INTERVIEW_INVITE_TTL_HOURS = 72;

/** Path the AI-interview invite link points at (`/interview/<token>`). */
export const AI_INTERVIEW_BASE_PATH = "/interview";

/** Default per-question answer window when the set/question doesn't override. */
export const AI_INTERVIEW_QUESTION_TIME_LIMIT_SECONDS = 90;

/** Minimum time a candidate must speak before "Next Question" is enabled. */
export const AI_INTERVIEW_MIN_RESPONSE_SECONDS = 10;

/** Cadence (ms) at which the browser flushes recording chunks to storage. */
export const AI_INTERVIEW_CHUNK_INTERVAL_MS = 30_000;

/** Human labels for the AI-interview question categories (Prisma enum). */
export const AI_INTERVIEW_QUESTION_TYPE_LABELS: Record<string, string> = {
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  COMMUNICATION: "Communication",
  MOTIVATION: "Motivation",
};

/** Gemini's hiring recommendation (SRS §3.5.3 FR-AI-009). */
export const AI_INTERVIEW_RECOMMENDATIONS = {
  STRONG_RECOMMEND: "STRONG_RECOMMEND",
  RECOMMEND: "RECOMMEND",
  NEUTRAL: "NEUTRAL",
  NOT_RECOMMEND: "NOT_RECOMMEND",
} as const;

export type InterviewRecommendation =
  (typeof AI_INTERVIEW_RECOMMENDATIONS)[keyof typeof AI_INTERVIEW_RECOMMENDATIONS];
export const AI_INTERVIEW_RECOMMENDATION_VALUES = Object.values(
  AI_INTERVIEW_RECOMMENDATIONS,
) as InterviewRecommendation[];

export const AI_INTERVIEW_RECOMMENDATION_LABELS: Record<
  InterviewRecommendation,
  string
> = {
  STRONG_RECOMMEND: "Strongly recommend",
  RECOMMEND: "Recommend",
  NEUTRAL: "Neutral",
  NOT_RECOMMEND: "Do not recommend",
};

/**
 * Fallback question bank used when a job has no `AIInterviewSet` configured, so
 * the candidate always has a complete interview. `expectedKeywords` is empty —
 * scoring is qualitative for these generic prompts.
 */
export const DEFAULT_AI_INTERVIEW_QUESTIONS = [
  {
    questionText:
      "Tell us about your professional background and the experience that makes you a strong fit for this role.",
    questionType: "MOTIVATION",
  },
  {
    questionText:
      "Describe a challenging situation you faced at work and how you handled it.",
    questionType: "BEHAVIORAL",
  },
  {
    questionText:
      "Walk us through the core technical skills you use day to day in your trade.",
    questionType: "TECHNICAL",
  },
  {
    questionText:
      "How do you communicate and coordinate with a team when working on-site?",
    questionType: "COMMUNICATION",
  },
  {
    questionText:
      "Why do you want to work abroad, and what are your goals for this opportunity?",
    questionType: "MOTIVATION",
  },
] as const;

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
/** Primary labor corridor for Phase 1 (Pakistan → Saudi Arabia). */
export const LABOR_CORRIDOR = { from: "PK", to: "SA" } as const;

// ---------------------------------------------------------------------------
// Job benefits — Section 3 of the admin Job Post form
// ---------------------------------------------------------------------------
export const JOB_BENEFITS = {
  ACCOMMODATION: "ACCOMMODATION",
  MEDICAL_INSURANCE: "MEDICAL_INSURANCE",
  TRANSPORT: "TRANSPORT",
  FOOD_ALLOWANCE: "FOOD_ALLOWANCE",
  ANNUAL_LEAVE: "ANNUAL_LEAVE",
  AIR_TICKET: "AIR_TICKET",
} as const;

export type JobBenefit = (typeof JOB_BENEFITS)[keyof typeof JOB_BENEFITS];
export const JOB_BENEFIT_VALUES = Object.values(JOB_BENEFITS) as JobBenefit[];

export const JOB_BENEFIT_LABELS: Record<JobBenefit, string> = {
  ACCOMMODATION: "Accommodation",
  MEDICAL_INSURANCE: "Medical Insurance",
  TRANSPORT: "Transport",
  FOOD_ALLOWANCE: "Food Allowance",
  ANNUAL_LEAVE: "Annual Leave",
  AIR_TICKET: "Air Ticket",
};

/** Admin page size for the jobs list. */
export const JOBS_PAGE_SIZE = 25;
