"use server";

import { authService } from "@/lib/services";
import { ROLE_HOME_ROUTE, type UserRole } from "@/lib/constants";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpCandidateSchema,
} from "@/lib/validations";

/**
 * Server Actions backing the auth forms. Each one validates with the shared Zod
 * schema (defence in depth — the client validates too) and delegates to
 * `authService`, the only layer that talks to Supabase Auth / the database.
 *
 * Results are returned as plain, serialisable objects so the calling Client
 * Component can drive toasts and navigation. We never throw across the boundary.
 */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; code?: "INVALID_LINK" };

const GENERIC_ERROR = "Something went wrong. Please try again.";

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
export async function signInAction(
  input: unknown,
): Promise<ActionResult<{ role: UserRole; redirectTo: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  try {
    const result = await authService.signIn(
      parsed.data.email,
      parsed.data.password,
    );
    if (!result.success || !result.user) {
      return { ok: false, error: result.error ?? "Invalid email or password." };
    }
    const role = result.user.role;
    return { ok: true, data: { role, redirectTo: ROLE_HOME_ROUTE[role] } };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ---------------------------------------------------------------------------
// Register (step 1) — create the candidate (Supabase emails the 6-digit code)
// ---------------------------------------------------------------------------
export async function registerAction(
  input: unknown,
): Promise<ActionResult<{ email: string; phone: string }>> {
  const parsed = signUpCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  try {
    const result = await authService.signUp(parsed.data);
    if (!result.success) {
      return { ok: false, error: result.error ?? GENERIC_ERROR };
    }
    // `signUp` triggers the "Confirm signup" email containing the verification
    // link the user clicks to activate their account.
    return { ok: true, data: { email: parsed.data.email, phone: parsed.data.phone } };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ---------------------------------------------------------------------------
// Forgot password — never reveal whether the email exists
// ---------------------------------------------------------------------------
export async function forgotPasswordAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  try {
    await authService.resetPassword(parsed.data.email);
  } catch {
    // Intentionally ignored — we always report success to avoid user enumeration.
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reset password — exchange the recovery code, then set the new password
// ---------------------------------------------------------------------------
export async function resetPasswordAction(input: {
  code: string | null;
  password: unknown;
  confirmPassword: unknown;
}): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: input.password,
    confirmPassword: input.confirmPassword,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  if (!input.code) {
    return {
      ok: false,
      error: "This reset link is invalid.",
      code: "INVALID_LINK",
    };
  }

  try {
    const exchanged = await authService.exchangeRecoveryCode(input.code);
    if (!exchanged) {
      return {
        ok: false,
        error: "This reset link has expired.",
        code: "INVALID_LINK",
      };
    }
    await authService.updatePassword(parsed.data.password);
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
