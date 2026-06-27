import { z } from "zod";
import {
  emailSchema,
  pakistaniPhoneSchema,
  passwordSchema,
} from "./common";

/**
 * Auth form/API schemas (Rule #6) — shared by React Hook Form resolvers on the
 * client and the auth API/actions on the server. Error messages are written in
 * plain English for direct display in the UI.
 */

const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Please enter your full name")
  .max(100, "Name must be at most 100 characters");

const confirmPasswordSchema = z.string().min(1, "Please confirm your password");

/** Candidate self-registration — SRS §3.1.1 FR-AUTH-001. */
export const signUpCandidateSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: pakistaniPhoneSchema,
    password: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpCandidateInput = z.infer<typeof signUpCandidateSchema>;
/** Input accepted by `authService.signUp`. */
export type SignUpInput = SignUpCandidateInput;

/** Email + password login. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Please enter your password"),
});

export type SignInInput = z.infer<typeof signInSchema>;

/** "Forgot password" — request a reset link. */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Set a new password after following the reset link. */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Phone OTP verification (6-digit SMS code). */
export const otpVerificationSchema = z.object({
  phone: pakistaniPhoneSchema,
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code sent to your phone"),
});

export type OtpVerificationInput = z.infer<typeof otpVerificationSchema>;
