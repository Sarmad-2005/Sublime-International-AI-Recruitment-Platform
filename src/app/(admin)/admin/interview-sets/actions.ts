"use server";

import { revalidatePath } from "next/cache";

import { authService, questionBankService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import {
  createInterviewSetSchema,
  interviewQuestionSchema,
  interviewSetSettingsSchema,
} from "@/lib/validations";
import type { AdminInterviewQuestion } from "@/types";

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

async function requireAdmin() {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Unauthorized");
  }
  return user;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SETS = `${ROUTES.ADMIN}/interview-sets`;

export async function createInterviewSetAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const parsed = createInterviewSetSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const result = await questionBankService.createInterviewSet(parsed.data, user.id);
    revalidatePath(SETS);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateInterviewSetAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = interviewSetSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    await questionBankService.updateInterviewSet(id, parsed.data);
    revalidatePath(SETS);
    revalidatePath(`${SETS}/${id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function addInterviewQuestionAction(
  setId: string,
  input: unknown,
): Promise<ActionResult<AdminInterviewQuestion>> {
  try {
    await requireAdmin();
    const parsed = interviewQuestionSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question" };
    }
    const question = await questionBankService.addInterviewQuestion(setId, parsed.data);
    revalidatePath(`${SETS}/${setId}`);
    return { ok: true, data: question };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateInterviewQuestionAction(
  setId: string,
  questionId: string,
  input: unknown,
): Promise<ActionResult<AdminInterviewQuestion>> {
  try {
    await requireAdmin();
    const parsed = interviewQuestionSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question" };
    }
    const question = await questionBankService.updateInterviewQuestion(
      questionId,
      parsed.data,
    );
    revalidatePath(`${SETS}/${setId}`);
    return { ok: true, data: question };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function deleteInterviewQuestionAction(
  setId: string,
  questionId: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    await questionBankService.deleteInterviewQuestion(questionId);
    revalidatePath(`${SETS}/${setId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function reorderInterviewQuestionsAction(
  setId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    await requireAdmin();
    await questionBankService.reorderInterviewQuestions(setId, orderedIds);
    revalidatePath(`${SETS}/${setId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
