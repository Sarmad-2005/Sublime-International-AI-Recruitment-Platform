"use server";

import { revalidatePath } from "next/cache";

import { authService, clientPortalService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import {
  clientCandidateStatusSchema,
  sendClientMessageSchema,
} from "@/lib/validations";
import type { ClientMessageDTO, ClientReviewStatusValue } from "@/types";

/**
 * Server Actions for the Saudi Client Portal. Auth/role is re-checked
 * server-side on every call; the UI guards are convenience only (Rule #5).
 */

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Ensure the caller is a signed-in Saudi client; return their user id. */
async function requireClientUserId(): Promise<string | null> {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.SAUDI_CLIENT) return null;
  return user.id;
}

/** Set the client's interest signal on a pooled candidate. */
export async function updateClientCandidateStatusAction(input: {
  applicationId: string;
  status: ClientReviewStatusValue;
}): Promise<ActionResult<{ status: ClientReviewStatusValue }>> {
  const userId = await requireClientUserId();
  if (!userId) return { ok: false, error: "Not authorized." };

  const parsed = clientCandidateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  try {
    const result = await clientPortalService.updateClientCandidateStatus(
      userId,
      parsed.data,
    );
    revalidatePath(`${ROUTES.CLIENT}/pool`);
    revalidatePath(`${ROUTES.CLIENT}/pool/${input.applicationId}`);
    revalidatePath(ROUTES.CLIENT_DASHBOARD);
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

/** Send a message (optionally with an attachment) to the support team. */
export async function sendClientMessageAction(input: {
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}): Promise<ActionResult<ClientMessageDTO>> {
  const userId = await requireClientUserId();
  if (!userId) return { ok: false, error: "Not authorized." };

  const parsed = sendClientMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message.",
    };
  }

  try {
    const message = await clientPortalService.sendMessage(userId, parsed.data);
    revalidatePath(`${ROUTES.CLIENT}/messages`);
    return { ok: true, data: message };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Message failed to send.",
    };
  }
}
