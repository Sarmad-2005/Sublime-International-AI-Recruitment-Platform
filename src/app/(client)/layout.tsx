import { redirect } from "next/navigation";

import { authService, clientPortalService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { ClientShell } from "@/components/client/ClientShell";

/**
 * Saudi Client Portal layout.
 *
 * Server-side role guard (defence in depth alongside the Edge middleware): only
 * a signed-in `SAUDI_CLIENT` may enter. Loads the company/contact identity and
 * the unread-message badge count, then renders the corporate portal chrome
 * (navy sidebar, white content area) around the page. English-only (B2B).
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.SAUDI_CLIENT) {
    redirect(ROUTES.LOGIN);
  }

  const [profile, unreadMessages] = await Promise.all([
    clientPortalService.getClientProfile(user.id),
    clientPortalService.getUnreadMessageCount(user.id),
  ]);

  return (
    <QueryProvider>
      <ClientShell
        companyName={profile?.companyName ?? ""}
        contactName={profile?.contactName ?? ""}
        email={user.email}
        logoUrl={profile?.logoUrl ?? null}
        unreadMessages={unreadMessages}
      >
        {children}
      </ClientShell>
      <Toaster />
    </QueryProvider>
  );
}
