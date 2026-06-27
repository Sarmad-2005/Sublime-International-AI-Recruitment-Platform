import "server-only";

import { Resend } from "resend";
import { serverEnv } from "@/lib/env";

/** Singleton Resend client for transactional email (server-only). */
export const resend = new Resend(serverEnv.RESEND_API_KEY);

/** Default "from" address for all SIORP transactional email. */
export const EMAIL_FROM = serverEnv.RESEND_FROM_EMAIL;
