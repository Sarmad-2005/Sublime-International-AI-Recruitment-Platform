import type { ApplicationStatus } from "@/generated/prisma/enums";

/**
 * Presentation helpers for application status — shared by the "My Applications"
 * list, the application detail page and any status badge. Pure + framework-free
 * so they run in Server or Client Components alike.
 */

/** Badge variants available in `@/components/ui/badge`. */
export type StatusVariant =
  | "success"
  | "destructive"
  | "brand"
  | "secondary"
  | "warning";

/** Colour treatment for a status badge. */
export function statusVariant(status: ApplicationStatus): StatusVariant {
  switch (status) {
    case "SELECTED":
    case "DEPLOYED":
    case "POST_SELECTION":
    case "ASSESSMENT_PASSED":
    case "CLIENT_SHORTLISTED":
      return "success";
    case "REJECTED":
    case "WITHDRAWN":
    case "ASSESSMENT_FAILED":
      return "destructive";
    case "ASSESSMENT_PENDING":
    case "INTERVIEW_INVITED":
      return "warning";
    default:
      return "brand";
  }
}

/** The context-aware next action a candidate can take on an application. */
export type ApplicationAction = "assessment" | "interview" | "results" | "track";

/** Which action button to surface for a given application status. */
export function applicationAction(status: ApplicationStatus): ApplicationAction {
  switch (status) {
    // After applying, the candidate's next step is the Stage-1 assessment. The
    // entry screen handles eligibility (CV present, assessment configured, …).
    case "APPLIED":
    case "ASSESSMENT_PENDING":
      return "assessment";
    case "INTERVIEW_INVITED":
      return "interview";
    case "ASSESSMENT_PASSED":
    case "ASSESSMENT_FAILED":
    case "INTERVIEW_COMPLETED":
    case "TIERED":
    case "REJECTED":
      return "results";
    default:
      return "track";
  }
}

/** Maps an action to its i18n key under `candidate.applications`. */
export const ACTION_LABEL_KEY: Record<ApplicationAction, string> = {
  assessment: "actionAssessment",
  interview: "actionInterview",
  results: "actionResults",
  track: "actionTrack",
};
