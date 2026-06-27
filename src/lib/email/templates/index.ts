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
