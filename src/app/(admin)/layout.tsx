import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { authService, candidateService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { AdminShell } from "@/components/admin";

/** Roles allowed inside the admin portal (defence in depth with the middleware). */
const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

/**
 * Admin portal layout.
 *
 * Server-side role guard alongside the Edge middleware: anyone who isn't a
 * signed-in Admin / Super Admin is bounced to login. Establishes the TanStack
 * Query provider, then renders the responsive admin chrome (sidebar, top bar
 * with global search, notifications and profile menu) around the page.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    redirect(ROUTES.LOGIN);
  }

  const [notifications, messages] = await Promise.all([
    candidateService.getNotificationFeed(user.id),
    getMessages(),
  ]);

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <AdminShell
          fullName=""
          email={user.email}
          role={user.role}
          profilePhotoUrl={null}
          notifications={notifications}
        >
          {children}
        </AdminShell>
        <Toaster />
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
