/**
 * Email templates for Resend.
 *
 * Each template is a pure function that returns a subject + body, so it can be
 * reused across every send site and unit-tested without sending mail. Concrete
 * templates (welcome, application status, interview invite, deployment update,
 * …) are added here as the relevant flows are built.
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

/** Minimal HTML escaping for values interpolated into email bodies. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ApplicationReceivedParams {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  /** Absolute URL to the candidate's application detail page. */
  applicationUrl: string;
}

/**
 * Confirmation email sent when a candidate submits an application (SRS M3 /
 * M11). Nudges the candidate toward their next step (the trade assessment).
 */
export function applicationReceivedEmail({
  candidateName,
  jobTitle,
  companyName,
  applicationUrl,
}: ApplicationReceivedParams): EmailTemplate {
  const name = candidateName.trim() || "there";
  const subject = `Application received — ${jobTitle}`;

  const text = [
    `Hi ${name},`,
    "",
    `We've received your application for ${jobTitle} at ${companyName}.`,
    "",
    "Your next step is to complete the trade assessment for this role. You can track your application status and take the assessment from your dashboard:",
    applicationUrl,
    "",
    "— Sublime International",
  ].join("\n");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;">
    <h2 style="color:#1e3a8a;">Application received</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>We've received your application for
      <strong>${escapeHtml(jobTitle)}</strong> at
      <strong>${escapeHtml(companyName)}</strong>.</p>
    <p>Your next step is to complete the <strong>trade assessment</strong> for this role.</p>
    <p style="margin:24px 0;">
      <a href="${escapeHtml(applicationUrl)}"
         style="background:#1e3a8a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
        View application &amp; take assessment
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;">— Sublime International</p>
  </div>`.trim();

  return { subject, html, text };
}

export interface AssessmentResultParams {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  passed: boolean;
  score: number;
  passingScore: number;
  /** Absolute URL to the candidate's assessment result page. */
  resultUrl: string;
}

/**
 * Notify a candidate of their trade-assessment outcome (SRS M4 / M11). On a pass
 * the AI-interview invite is sent separately by `aiInterviewInviteEmail`.
 */
export function assessmentResultEmail({
  candidateName,
  jobTitle,
  companyName,
  passed,
  score,
  passingScore,
  resultUrl,
}: AssessmentResultParams): EmailTemplate {
  const name = candidateName.trim() || "there";
  const subject = passed
    ? `You passed the ${jobTitle} assessment`
    : `Your ${jobTitle} assessment result`;

  const outcomeText = passed
    ? `Congratulations — you scored ${score}% and passed the trade assessment for ${jobTitle} at ${companyName}. Watch for your AI interview invitation, arriving by email shortly.`
    : `You scored ${score}% on the trade assessment for ${jobTitle} at ${companyName}. The passing score is ${passingScore}%.`;

  const text = [
    `Hi ${name},`,
    "",
    outcomeText,
    "",
    "View your full result here:",
    resultUrl,
    "",
    "— Sublime International",
  ].join("\n");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;">
    <h2 style="color:${passed ? "#047857" : "#1e3a8a"};">
      ${passed ? "Assessment passed 🎉" : "Assessment result"}
    </h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>${escapeHtml(outcomeText)}</p>
    <p style="margin:24px 0;">
      <a href="${escapeHtml(resultUrl)}"
         style="background:#1e3a8a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
        View your result
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;">— Sublime International</p>
  </div>`.trim();

  return { subject, html, text };
}

export interface AIInterviewInviteParams {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  /** Absolute URL with the one-time invite token. */
  interviewUrl: string;
  /** When the link expires (formatted for display). */
  expiresAtLabel: string;
}

/**
 * Invite a candidate who passed Stage 1 to the AI interview (SRS M5 / M11). The
 * link carries a one-time token and expires after a fixed window.
 */
export function aiInterviewInviteEmail({
  candidateName,
  jobTitle,
  companyName,
  interviewUrl,
  expiresAtLabel,
}: AIInterviewInviteParams): EmailTemplate {
  const name = candidateName.trim() || "there";
  const subject = `Your AI interview invitation — ${jobTitle}`;

  const text = [
    `Hi ${name},`,
    "",
    `Great news — you've advanced to the AI interview for ${jobTitle} at ${companyName}.`,
    "",
    `Start your interview using the link below. It expires on ${expiresAtLabel}, so please complete it before then:`,
    interviewUrl,
    "",
    "Find a quiet, well-lit space and make sure your camera and microphone work before you begin.",
    "",
    "— Sublime International",
  ].join("\n");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;">
    <h2 style="color:#1e3a8a;">You're invited to the AI interview</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Great news — you've advanced to the <strong>AI interview</strong> for
      <strong>${escapeHtml(jobTitle)}</strong> at
      <strong>${escapeHtml(companyName)}</strong>.</p>
    <p style="margin:24px 0;">
      <a href="${escapeHtml(interviewUrl)}"
         style="background:#1e3a8a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
        Start AI interview
      </a>
    </p>
    <p style="color:#b45309;font-size:13px;">
      This link expires on ${escapeHtml(expiresAtLabel)}.
    </p>
    <p style="color:#6b7280;font-size:13px;">
      Find a quiet, well-lit space and check your camera and microphone before you begin.
    </p>
    <p style="color:#6b7280;font-size:13px;">— Sublime International</p>
  </div>`.trim();

  return { subject, html, text };
}

export interface InterviewTierResultParams {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  /** Display tier name, e.g. "Gold". */
  tierLabel: string;
  /** Weighted final score (0–100). */
  finalScore: number;
  /** Absolute URL to the candidate's application detail page. */
  applicationUrl: string;
}

/**
 * Congratulate a candidate whose AI interview was scored and tier assigned
 * (SRS M5 / M6 / M11). They are now shortlisted into the employer pool.
 */
export function interviewTierResultEmail({
  candidateName,
  jobTitle,
  companyName,
  tierLabel,
  finalScore,
  applicationUrl,
}: InterviewTierResultParams): EmailTemplate {
  const name = candidateName.trim() || "there";
  const subject = `You've been shortlisted — ${tierLabel} tier`;
  const rounded = Math.round(finalScore);

  const text = [
    `Hi ${name},`,
    "",
    `Congratulations — you've completed the AI interview for ${jobTitle} at ${companyName}.`,
    "",
    `Based on your assessment and interview, you've been placed in the ${tierLabel} tier (overall score ${rounded}/100) and shortlisted for employer review.`,
    "",
    "Track your status here:",
    applicationUrl,
    "",
    "— Sublime International",
  ].join("\n");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;">
    <h2 style="color:#047857;">You're shortlisted 🎉</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Congratulations — you've completed the <strong>AI interview</strong> for
      <strong>${escapeHtml(jobTitle)}</strong> at
      <strong>${escapeHtml(companyName)}</strong>.</p>
    <p>Based on your assessment and interview, you've been placed in the
      <strong>${escapeHtml(tierLabel)}</strong> tier
      (overall score <strong>${rounded}/100</strong>) and shortlisted for
      employer review.</p>
    <p style="margin:24px 0;">
      <a href="${escapeHtml(applicationUrl)}"
         style="background:#1e3a8a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
        View your application
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;">— Sublime International</p>
  </div>`.trim();

  return { subject, html, text };
}
