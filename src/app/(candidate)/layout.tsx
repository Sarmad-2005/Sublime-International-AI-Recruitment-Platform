import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { authService, candidateService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { CandidateShell } from "@/components/candidate/CandidateShell";

/**
 * Candidate portal layout.
 *
 * Server-side role guard (defence in depth alongside the Edge middleware):
 * anyone who isn't a signed-in candidate is bounced to login. Establishes the
 * next-intl + TanStack Query providers, then renders the responsive portal
 * chrome (top nav, collapsible desktop sidebar, mobile bottom nav, notification
 * bell) around the page.
 */
export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    redirect(ROUTES.LOGIN);
  }

  const [profile, notifications, messages] = await Promise.all([
    candidateService.getCandidateProfile(user.id),
    candidateService.getNotificationFeed(user.id),
    getMessages(),
  ]);

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <CandidateShell
          fullName={profile?.fullName ?? ""}
          email={user.email}
          profilePhotoUrl={profile?.profilePhotoUrl ?? null}
          notifications={notifications}
        >
          {children}
        </CandidateShell>
        <Toaster />
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
