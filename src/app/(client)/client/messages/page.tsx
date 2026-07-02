import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { authService, clientPortalService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { MessageThread } from "@/components/client/MessageThread";

export const metadata: Metadata = {
  title: "Messages — Sublime International",
};

/** Client ↔ team messaging (Server Component shell + realtime client thread). */
export default async function ClientMessagesPage() {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.SAUDI_CLIENT) {
    redirect(ROUTES.LOGIN);
  }

  const thread = await clientPortalService.getMessages(user.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Talk directly with the Sublime International recruitment team.
        </p>
      </div>

      <MessageThread
        initialMessages={thread.messages}
        clientUserId={thread.clientUserId}
      />
    </div>
  );
}
