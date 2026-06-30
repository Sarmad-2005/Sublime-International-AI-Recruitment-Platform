import { Toaster } from "@/components/ui/sonner";

/**
 * Standalone layout for the token-based AI interview (SRS M5). Deliberately
 * *outside* the `(candidate)` group: the interview is reachable with only the
 * one-time invite token (no login), and the proctored full-screen flow shouldn't
 * carry the candidate-portal chrome. Provides just the toast host.
 */
export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
