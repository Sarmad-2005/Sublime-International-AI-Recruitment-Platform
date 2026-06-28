import "server-only";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import { extractUserRole } from "@/lib/supabase/roles";
import { clientEnv } from "@/lib/env";
import { ROUTES, USER_ROLES, type UserRole } from "@/lib/constants";
import type {
  AuthResult,
  CandidateProfileSummary,
  UserWithRole,
} from "@/types";
import type { SignUpInput } from "@/lib/validations";

/**
 * Auth service — the bridge between Supabase Auth (identity, passwords, OTP) and
 * the SIORP `users` table in Postgres (roles, profiles, app data). Per Rule #5
 * this is the only layer that touches the database for auth.
 *
 * Identity model:
 *   - Supabase Auth owns credentials (password hashing, email/phone verification).
 *   - The Prisma `User.id` is set to the Supabase Auth user id, so the two stay
 *     linked 1:1 without a separate `authId` column.
 *   - The role is mirrored into Supabase `app_metadata` (tamper-proof, read by
 *     the Edge middleware) and is authoritative in the database.
 */

/**
 * Supabase Auth owns the real credentials, so the legacy non-null
 * `users.password_hash` column never holds a usable hash. We store a sentinel to
 * make that explicit (and to satisfy the NOT NULL constraint).
 */
const SUPABASE_MANAGED_PASSWORD = "supabase-auth-managed";

/** Columns that make up `UserWithRole`, for reuse across queries. */
const userWithRoleSelect = {
  id: true,
  email: true,
  phone: true,
  role: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function appUrl(path: string): string {
  return new URL(path, clientEnv.NEXT_PUBLIC_APP_URL).toString();
}

// ---------------------------------------------------------------------------
// Sign up / sign in / sign out
// ---------------------------------------------------------------------------

/**
 * Register a new candidate: create the Supabase Auth user (which sends the email
 * verification), then mirror them into the database.
 */
export async function signUp(data: SignUpInput): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();

  const { data: result, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName,
        phone: data.phone,
        role: USER_ROLES.CANDIDATE,
      },
      // TODO(auth): point this at a /auth/confirm handler once the email-confirm
      // UI lands; for now the link returns the user to the login screen.
      emailRedirectTo: appUrl(ROUTES.LOGIN),
    },
  });

  if (error || !result.user) {
    return {
      success: false,
      user: null,
      error: error?.message ?? "We couldn't create your account. Please try again.",
    };
  }

  // Supabase deliberately does NOT error when the email is already registered
  // (to avoid leaking which emails exist). Instead it returns a user whose
  // `identities` array is empty. Detect that and surface a clear message rather
  // than letting the duplicate-email DB write blow up as a generic error.
  if (Array.isArray(result.user.identities) && result.user.identities.length === 0) {
    return {
      success: false,
      user: null,
      error: "An account with this email already exists. Please sign in instead.",
    };
  }

  await syncUserToDatabase(result.user);

  const user = await prisma.user.findUnique({
    where: { id: result.user.id },
    select: userWithRoleSelect,
  });

  return { success: true, user, error: null };
}

/** Email + password login. Stamps `lastLoginAt` on success. */
export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      success: false,
      user: null,
      error: error?.message ?? "Invalid email or password.",
    };
  }

  // Self-heal: if the database row is missing (e.g. an interrupted sign-up),
  // recreate it from the Supabase user before stamping the login time.
  const existing = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: { id: true },
  });
  if (!existing) {
    await syncUserToDatabase(data.user);
  }

  const user = await prisma.user.update({
    where: { id: data.user.id },
    data: { lastLoginAt: new Date() },
    select: userWithRoleSelect,
  });

  return { success: true, user, error: null };
}

/** Sign out the current session. */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// Verification & password management
// ---------------------------------------------------------------------------

/** Re-send the sign-up email verification link. */
export async function sendEmailVerification(email: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw new Error(error.message);
}

/** Verify a phone number with the 6-digit SMS OTP. Returns whether it matched. */
export async function verifyOTP(phone: string, token: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error || !data.user) return false;

  await prisma.user.updateMany({
    where: { id: data.user.id },
    data: { isPhoneVerified: true },
  });

  return true;
}

/** Send a password-reset email that lands on the reset-password screen. */
export async function resetPassword(email: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl(ROUTES.RESET_PASSWORD),
  });
  if (error) throw new Error(error.message);
}

/**
 * Exchange a password-recovery `code` (PKCE flow) from the reset-link URL for a
 * short-lived session, so `updatePassword` can run against it. Returns whether
 * the exchange succeeded (an expired/used link yields `false`).
 */
export async function exchangeRecoveryCode(code: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return !error;
}

/** Set a new password for the currently-authenticated (recovery) session. */
export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Current user / profile reads
// ---------------------------------------------------------------------------

/** The signed-in SIORP user (validated session → database row), or `null`. */
export async function getCurrentUser(): Promise<UserWithRole | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return prisma.user.findUnique({
    where: { id: user.id },
    select: userWithRoleSelect,
  });
}

/** The candidate profile for a given user id, or `null` if none exists yet. */
export async function getCurrentCandidateProfile(
  userId: string,
): Promise<CandidateProfileSummary | null> {
  return prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      fullName: true,
      primaryTrade: true,
      secondaryTrade: true,
      yearsOfExperience: true,
      city: true,
      profilePhotoUrl: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Database sync
// ---------------------------------------------------------------------------

/**
 * Create (or update) the SIORP `users` row for a Supabase Auth user, and mirror
 * the role into `app_metadata` so the Edge middleware can authorize without a DB
 * round-trip. Idempotent — safe to call on every sign-up / sign-in repair.
 */
export async function syncUserToDatabase(
  supabaseUser: SupabaseUser,
): Promise<void> {
  const email = supabaseUser.email;
  if (!email) {
    throw new Error("Cannot sync a Supabase user without an email address.");
  }

  const role: UserRole = extractUserRole(supabaseUser) ?? USER_ROLES.CANDIDATE;
  const phone = readStringMetadata(supabaseUser, "phone") ?? supabaseUser.phone ?? null;
  const isEmailVerified = Boolean(supabaseUser.email_confirmed_at);
  const isPhoneVerified = Boolean(supabaseUser.phone_confirmed_at);

  await prisma.user.upsert({
    where: { id: supabaseUser.id },
    create: {
      id: supabaseUser.id,
      email,
      phone,
      role,
      passwordHash: SUPABASE_MANAGED_PASSWORD,
      isEmailVerified,
      isPhoneVerified,
    },
    update: {
      email,
      phone,
      isEmailVerified,
      isPhoneVerified,
    },
  });

  // Make the role authoritative & tamper-proof on the Supabase side. A failure
  // here must not fail the sign-up — `user_metadata.role` remains as a fallback.
  try {
    const admin = createSupabaseAdminClient();
    await admin.auth.admin.updateUserById(supabaseUser.id, {
      app_metadata: { role },
    });
  } catch (cause) {
    console.error("Failed to set app_metadata.role for", supabaseUser.id, cause);
  }
}

function readStringMetadata(
  user: SupabaseUser,
  key: string,
): string | null {
  const value: unknown = user.user_metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
