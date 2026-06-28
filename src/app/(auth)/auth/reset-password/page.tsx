import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password — SIORP",
};

/**
 * Reset-password screen. The form reads the recovery `code` from the URL via
 * `useSearchParams`, so it's wrapped in `Suspense` to satisfy Next.js's
 * static-rendering bailout requirement.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64" aria-hidden />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
