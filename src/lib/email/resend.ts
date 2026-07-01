import "server-only";

import { Resend } from "resend";
import { serverEnv } from "@/lib/env";
import type { EmailTemplate } from "./templates";

/** Singleton Resend client for transactional email (server-only). */
export const resend = new Resend(serverEnv.RESEND_API_KEY);

/** Default "from" address for all SIORP transactional email. */
export const EMAIL_FROM = serverEnv.RESEND_FROM_EMAIL;

/**
 * Send a rendered {@link EmailTemplate} to one recipient from the default
 * address. Throws on failure — callers wrap best-effort sends in try/catch.
 */
export async function sendEmail(
  to: string,
  template: EmailTemplate,
): Promise<void> {
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}
