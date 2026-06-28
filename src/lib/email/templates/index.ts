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
