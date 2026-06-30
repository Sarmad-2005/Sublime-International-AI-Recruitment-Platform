import { z } from "zod";

/**
 * Centralized, type-safe environment variables (Rule #3).
 *
 * Every variable is validated once at startup with Zod, so the app fails fast
 * on misconfiguration instead of throwing deep inside a request.
 *
 * - `serverEnv` holds secrets and is only validated/accessible on the server.
 * - `clientEnv` holds `NEXT_PUBLIC_*` values that are safe in the browser.
 *
 * Never read `process.env` directly elsewhere — import from this module so
 * every value is validated and typed.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database — Supabase Postgres.
  // Pooled (PgBouncer) connection used by the app runtime via the Prisma adapter.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Direct (non-pooled) connection used by Prisma Migrate. Optional in dev.
  DIRECT_URL: z.string().min(1).optional(),

  // Supabase privileged server key (bypasses RLS — server only).
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Resend transactional email.
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM_EMAIL: z.email("RESEND_FROM_EMAIL must be a valid email"),

  // uploadthing file uploads (CVs, profile photos).
  UPLOADTHING_TOKEN: z.string().min(1, "UPLOADTHING_TOKEN is required"),

  // Google Gemini API — AI interviewer + scoring (SRS M5, server-only).
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),

  // Supabase Storage bucket for AI-interview recordings & identity snapshots.
  INTERVIEW_RECORDINGS_BUCKET: z.string().min(1).default("interview-recordings"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.url("NEXT_PUBLIC_APP_URL must be a valid URL"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

const isServer = typeof window === "undefined";

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/**
 * `NEXT_PUBLIC_*` vars are statically inlined by Next.js, so they must be
 * referenced explicitly (never via a dynamic `process.env[key]` lookup).
 */
function parseClientEnv(): ClientEnv {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    throw new Error(
      `❌ Invalid public environment variables:\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

function parseServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `❌ Invalid server environment variables:\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

/** Validated public env — safe to import anywhere (server or browser). */
export const clientEnv: ClientEnv = parseClientEnv();

/**
 * Validated server env. Accessing this in the browser throws — use `clientEnv`
 * in code that runs client-side.
 */
export const serverEnv: ServerEnv = isServer
  ? parseServerEnv()
  : new Proxy({} as ServerEnv, {
      get() {
        throw new Error(
          "`serverEnv` is not available in the browser. Import `clientEnv` instead.",
        );
      },
    });
