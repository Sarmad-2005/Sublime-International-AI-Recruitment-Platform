"use server";

import { revalidatePath } from "next/cache";

import { authService, questionBankService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import {
  assessmentQuestionSchema,
  createQuestionBankSchema,
  questionBankSettingsSchema,
} from "@/lib/validations";
import type {
  AdminQuestion,
  ImportResult,
} from "@/types";

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

const BANKS = `${ROUTES.ADMIN}/question-banks`;

export async function createBankAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const parsed = createQuestionBankSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const result = await questionBankService.createBank(parsed.data, user.id);
    revalidatePath(BANKS);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateBankAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = questionBankSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    await questionBankService.updateBank(id, parsed.data);
    revalidatePath(BANKS);
    revalidatePath(`${BANKS}/${id}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function addQuestionAction(
  bankId: string,
  input: unknown,
): Promise<ActionResult<AdminQuestion>> {
  try {
    await requireAdmin();
    const parsed = assessmentQuestionSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question" };
    }
    const question = await questionBankService.addQuestion(bankId, parsed.data);
    revalidatePath(`${BANKS}/${bankId}`);
    return { ok: true, data: question };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateQuestionAction(
  bankId: string,
  questionId: string,
  input: unknown,
): Promise<ActionResult<AdminQuestion>> {
  try {
    await requireAdmin();
    const parsed = assessmentQuestionSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question" };
    }
    const question = await questionBankService.updateQuestion(questionId, parsed.data);
    revalidatePath(`${BANKS}/${bankId}`);
    return { ok: true, data: question };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function deleteQuestionAction(
  bankId: string,
  questionId: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    await questionBankService.deleteQuestion(questionId);
    revalidatePath(`${BANKS}/${bankId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function reorderQuestionsAction(
  bankId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    await requireAdmin();
    await questionBankService.reorderQuestions(bankId, orderedIds);
    revalidatePath(`${BANKS}/${bankId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function importQuestionsAction(
  bankId: string,
  csvText: string,
): Promise<ActionResult<ImportResult>> {
  try {
    await requireAdmin();
    const result = await questionBankService.importQuestionsFromCSV(bankId, csvText);
    revalidatePath(`${BANKS}/${bankId}`);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
