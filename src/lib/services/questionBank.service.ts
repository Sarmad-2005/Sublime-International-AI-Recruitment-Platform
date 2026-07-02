import "server-only";

import { randomUUID } from "node:crypto";

import { prisma, Prisma } from "@/lib/prisma";
import { SINGLE_ANSWER_QUESTION_TYPES } from "@/lib/constants";
import {
  parseQuestionOptions,
  parseJsonStringArray,
} from "@/lib/utils/questionJson";
import type { QuestionType } from "@/generated/prisma/enums";
import type {
  AdminInterviewQuestion,
  AdminQuestion,
  ImportResult,
  InterviewSetDetail,
  InterviewSetListItem,
  LinkableJob,
  QuestionBankDetail,
  QuestionBankListItem,
} from "@/types";
import {
  csvQuestionRowSchema,
  type AssessmentQuestionInput,
  type CreateInterviewSetInput,
  type CreateQuestionBankInput,
  type InterviewQuestionInput,
  type InterviewSetSettingsInput,
  type QuestionBankSettingsInput,
} from "@/lib/validations";

/**
 * Question-bank & AI-interview-set service (SRS M4 / M5) — the only layer that
 * reads/writes `TradeAssessment`, `AssessmentQuestion`, `AIInterviewSet` and
 * `AIInterviewQuestion` for the admin editors (Rule #5). Returns JSON-safe DTOs.
 *
 * A bank / interview set is 1:1 with a `JobPost` (unique `jobPostId`), so
 * creating one requires picking a job that doesn't already have one.
 */

/** Raised for expected, user-facing failures. */
export class QuestionBankError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "JOB_TAKEN" | "INVALID" = "NOT_FOUND",
  ) {
    super(message);
    this.name = "QuestionBankError";
  }
}

// ---------------------------------------------------------------------------
// JSON (de)serialisation — `options` / `correctAnswers` are opaque JSON columns.
// Parsers are shared with the candidate assessment service (@/lib/utils/questionJson).
// ---------------------------------------------------------------------------

function optionsToJson(
  options: AssessmentQuestionInput["options"],
): Prisma.InputJsonValue {
  return options.map((o) => ({
    id: o.id,
    text: o.text,
    imageUrl: o.imageUrl ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

type QuestionRow = Prisma.AssessmentQuestionGetPayload<object>;

function toAdminQuestion(q: QuestionRow): AdminQuestion {
  return {
    id: q.id,
    type: q.type,
    questionText: q.questionText,
    imageUrl: q.imageUrl,
    options: parseQuestionOptions(q.options),
    correctAnswers: parseJsonStringArray(q.correctAnswers),
    points: q.points,
    orderIndex: q.orderIndex,
  };
}

// ---------------------------------------------------------------------------
// Question banks (Trade Assessments)
// ---------------------------------------------------------------------------

const bankListSelect = {
  id: true,
  title: true,
  jobPostId: true,
  passingScore: true,
  totalQuestions: true,
  isActive: true,
  updatedAt: true,
  jobPost: {
    select: { title: true, saudiClient: { select: { companyName: true } } },
  },
} satisfies Prisma.TradeAssessmentSelect;

/** All question banks, most-recently-updated first. */
export async function getBanks(): Promise<QuestionBankListItem[]> {
  const rows = await prisma.tradeAssessment.findMany({
    orderBy: { updatedAt: "desc" },
    select: bankListSelect,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    jobPostId: r.jobPostId,
    jobTitle: r.jobPost.title,
    companyName: r.jobPost.saudiClient.companyName,
    totalQuestions: r.totalQuestions,
    passingScore: r.passingScore,
    isActive: r.isActive,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Full bank detail (settings + ordered questions) for the editor. */
export async function getBankDetail(id: string): Promise<QuestionBankDetail | null> {
  const bank = await prisma.tradeAssessment.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { orderIndex: "asc" } },
      jobPost: {
        select: { title: true, saudiClient: { select: { companyName: true } } },
      },
    },
  });
  if (!bank) return null;

  return {
    id: bank.id,
    jobPostId: bank.jobPostId,
    jobTitle: bank.jobPost.title,
    companyName: bank.jobPost.saudiClient.companyName,
    title: bank.title,
    description: bank.description,
    timeLimitMinutes: bank.timeLimitMinutes,
    passingScore: bank.passingScore,
    allowRetake: bank.allowRetake,
    retakeCooldownDays: bank.retakeCooldownDays,
    randomizeQuestions: bank.randomizeQuestions,
    randomizeAnswers: bank.randomizeAnswers,
    isActive: bank.isActive,
    totalQuestions: bank.totalQuestions,
    questions: bank.questions.map(toAdminQuestion),
    updatedAt: bank.updatedAt.toISOString(),
  };
}

/** Job posts that don't yet have a linked assessment (candidates for a new bank). */
export async function getLinkableJobsForAssessment(): Promise<LinkableJob[]> {
  const jobs = await prisma.jobPost.findMany({
    where: { tradeAssessment: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      saudiClient: { select: { companyName: true } },
    },
  });
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    companyName: j.saudiClient.companyName,
  }));
}

/** Create a new question bank linked to a job post. */
export async function createBank(
  data: CreateQuestionBankInput,
  _adminId: string,
): Promise<{ id: string }> {
  const existing = await prisma.tradeAssessment.findUnique({
    where: { jobPostId: data.jobPostId },
    select: { id: true },
  });
  if (existing) {
    throw new QuestionBankError(
      "This job already has a question bank.",
      "JOB_TAKEN",
    );
  }

  const bank = await prisma.tradeAssessment.create({
    data: {
      jobPostId: data.jobPostId,
      title: data.title,
      description: data.description ?? null,
      timeLimitMinutes: data.timeLimitMinutes,
      passingScore: data.passingScore,
      allowRetake: data.allowRetake,
      retakeCooldownDays: data.retakeCooldownDays,
      randomizeQuestions: data.randomizeQuestions,
      randomizeAnswers: data.randomizeAnswers,
      isActive: data.isActive,
    },
    select: { id: true },
  });
  return bank;
}

/** Update a bank's settings. */
export async function updateBank(
  id: string,
  data: QuestionBankSettingsInput,
): Promise<void> {
  await prisma.tradeAssessment.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description ?? null,
      timeLimitMinutes: data.timeLimitMinutes,
      passingScore: data.passingScore,
      allowRetake: data.allowRetake,
      retakeCooldownDays: data.retakeCooldownDays,
      randomizeQuestions: data.randomizeQuestions,
      randomizeAnswers: data.randomizeAnswers,
      isActive: data.isActive,
    },
  });
}

/** Recompute + persist `totalQuestions` for a bank (kept in sync for the list). */
async function syncQuestionCount(
  tx: Prisma.TransactionClient,
  bankId: string,
): Promise<number> {
  const count = await tx.assessmentQuestion.count({
    where: { assessmentId: bankId },
  });
  await tx.tradeAssessment.update({
    where: { id: bankId },
    data: { totalQuestions: count },
  });
  return count;
}

/** Append a question to a bank (placed last). */
export async function addQuestion(
  bankId: string,
  input: AssessmentQuestionInput,
): Promise<AdminQuestion> {
  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.assessmentQuestion.findFirst({
      where: { assessmentId: bankId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    const question = await tx.assessmentQuestion.create({
      data: {
        assessmentId: bankId,
        type: input.type,
        questionText: input.questionText,
        imageUrl: input.imageUrl ?? null,
        options: optionsToJson(input.options),
        correctAnswers: input.correctAnswers,
        points: input.points,
        orderIndex: (last?.orderIndex ?? -1) + 1,
      },
    });
    await syncQuestionCount(tx, bankId);
    return question;
  });
  return toAdminQuestion(created);
}

/** Update an existing question. */
export async function updateQuestion(
  id: string,
  input: AssessmentQuestionInput,
): Promise<AdminQuestion> {
  const updated = await prisma.assessmentQuestion.update({
    where: { id },
    data: {
      type: input.type,
      questionText: input.questionText,
      imageUrl: input.imageUrl ?? null,
      options: optionsToJson(input.options),
      correctAnswers: input.correctAnswers,
      points: input.points,
    },
  });
  return toAdminQuestion(updated);
}

/** Delete a question and refresh the bank's total. */
export async function deleteQuestion(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const q = await tx.assessmentQuestion.delete({
      where: { id },
      select: { assessmentId: true },
    });
    await syncQuestionCount(tx, q.assessmentId);
  });
}

/** Persist a new question order (ids in the desired order). */
export async function reorderQuestions(
  bankId: string,
  orderedIds: string[],
): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.assessmentQuestion.updateMany({
        where: { id, assessmentId: bankId },
        data: { orderIndex: index },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// CSV bulk import
// ---------------------------------------------------------------------------

/**
 * Parse raw CSV text into records of fields. Handles quoted fields containing
 * commas, escaped double-quotes (`""`) and CRLF/newlines inside quotes.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const src = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignore — handled by the following \n
    } else {
      field += ch;
    }
  }
  // flush trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** The header we expect for the downloadable template. */
const CSV_COLUMNS = [
  "type",
  "question",
  "points",
  "option1",
  "option2",
  "option3",
  "option4",
  "option5",
  "option6",
  "correct",
] as const;

/**
 * Import questions from CSV text. Validates each row; valid rows are appended to
 * the bank in order. Returns a per-row error report — one bad row never blocks
 * the good ones.
 */
export async function importQuestionsFromCSV(
  bankId: string,
  csvText: string,
): Promise<ImportResult> {
  const bank = await prisma.tradeAssessment.findUnique({
    where: { id: bankId },
    select: { id: true },
  });
  if (!bank) throw new QuestionBankError("Question bank not found.", "NOT_FOUND");

  const records = parseCsv(csvText);
  if (records.length === 0) {
    return { imported: 0, failed: 0, errors: [] };
  }

  // Detect + drop a header row (first cell isn't a valid type).
  const first = records[0]!.map((c) => c.trim().toLowerCase());
  const hasHeader = first[0] === "type" || first.includes("question");
  const dataRows = hasHeader ? records.slice(1) : records;

  const errors: ImportResult["errors"] = [];
  const toCreate: AssessmentQuestionInput[] = [];

  dataRows.forEach((cols, i) => {
    // +1 for 1-based, +1 more when a header was skipped.
    const rowNumber = i + 1 + (hasHeader ? 1 : 0);
    const get = (idx: number) => (cols[idx] ?? "").trim();

    const type = get(0).toUpperCase();
    const question = get(1);
    const pointsRaw = get(2);
    const options = [get(3), get(4), get(5), get(6), get(7), get(8)].filter(
      (o) => o !== "",
    );
    const correctIndices = get(9)
      .split(/[;|]/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    const parsed = csvQuestionRowSchema.safeParse({
      type,
      questionText: question,
      options,
      correctIndices,
      points: pointsRaw ? Number(pointsRaw) : 1,
    });

    if (!parsed.success) {
      errors.push({
        row: rowNumber,
        message: parsed.error.issues[0]?.message ?? "Invalid row",
      });
      return;
    }

    const data = parsed.data;
    // Correct indices must be within range.
    if (data.correctIndices.some((n) => n > data.options.length)) {
      errors.push({ row: rowNumber, message: "Correct index out of range" });
      return;
    }
    // Single-answer types accept exactly one correct index.
    const isSingle = (SINGLE_ANSWER_QUESTION_TYPES as readonly string[]).includes(
      data.type,
    );
    if (isSingle && data.correctIndices.length !== 1) {
      errors.push({
        row: rowNumber,
        message: `${data.type} needs exactly one correct answer`,
      });
      return;
    }

    const built = data.options.map((text) => ({
      id: randomUUID(),
      text,
      imageUrl: null,
    }));
    const correctAnswers = data.correctIndices.map((n) => built[n - 1]!.id);

    toCreate.push({
      type: data.type as QuestionType,
      questionText: data.questionText,
      imageUrl: null,
      options: built,
      correctAnswers,
      points: data.points,
    });
  });

  if (toCreate.length > 0) {
    await prisma.$transaction(async (tx) => {
      const last = await tx.assessmentQuestion.findFirst({
        where: { assessmentId: bankId },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });
      let order = (last?.orderIndex ?? -1) + 1;
      for (const q of toCreate) {
        await tx.assessmentQuestion.create({
          data: {
            assessmentId: bankId,
            type: q.type,
            questionText: q.questionText,
            imageUrl: null,
            options: optionsToJson(q.options),
            correctAnswers: q.correctAnswers,
            points: q.points,
            orderIndex: order++,
          },
        });
      }
      await syncQuestionCount(tx, bankId);
    });
  }

  return {
    imported: toCreate.length,
    failed: errors.length,
    errors,
  };
}

/** Column order for the downloadable CSV template. */
export function csvTemplateColumns(): readonly string[] {
  return CSV_COLUMNS;
}

// ---------------------------------------------------------------------------
// AI interview sets
// ---------------------------------------------------------------------------

type InterviewQuestionRow = Prisma.AIInterviewQuestionGetPayload<object>;

function toAdminInterviewQuestion(
  q: InterviewQuestionRow,
): AdminInterviewQuestion {
  return {
    id: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    expectedKeywords: parseJsonStringArray(q.expectedKeywords),
    maxTimeSeconds: q.maxTimeSeconds,
    orderIndex: q.orderIndex,
  };
}

const interviewSetListSelect = {
  id: true,
  title: true,
  jobPostId: true,
  maxDurationMinutes: true,
  updatedAt: true,
  jobPost: {
    select: { title: true, saudiClient: { select: { companyName: true } } },
  },
  _count: { select: { questions: true } },
} satisfies Prisma.AIInterviewSetSelect;

/** All AI interview sets, most-recently-updated first. */
export async function getInterviewSets(): Promise<InterviewSetListItem[]> {
  const rows = await prisma.aIInterviewSet.findMany({
    orderBy: { updatedAt: "desc" },
    select: interviewSetListSelect,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    jobPostId: r.jobPostId,
    jobTitle: r.jobPost.title,
    companyName: r.jobPost.saudiClient.companyName,
    questionCount: r._count.questions,
    maxDurationMinutes: r.maxDurationMinutes,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Full interview-set detail (settings + ordered questions). */
export async function getInterviewSetDetail(
  id: string,
): Promise<InterviewSetDetail | null> {
  const set = await prisma.aIInterviewSet.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { orderIndex: "asc" } },
      jobPost: {
        select: { title: true, saudiClient: { select: { companyName: true } } },
      },
    },
  });
  if (!set) return null;

  return {
    id: set.id,
    jobPostId: set.jobPostId,
    jobTitle: set.jobPost.title,
    companyName: set.jobPost.saudiClient.companyName,
    title: set.title,
    description: set.description,
    maxDurationMinutes: set.maxDurationMinutes,
    questionTimeLimitSeconds: set.questionTimeLimitSeconds,
    isActive: set.isActive,
    questions: set.questions.map(toAdminInterviewQuestion),
    updatedAt: set.updatedAt.toISOString(),
  };
}

/** Job posts without a linked interview set. */
export async function getLinkableJobsForInterview(): Promise<LinkableJob[]> {
  const jobs = await prisma.jobPost.findMany({
    where: { aiInterviewSet: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      saudiClient: { select: { companyName: true } },
    },
  });
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    companyName: j.saudiClient.companyName,
  }));
}

/** Create an AI interview set linked to a job post. */
export async function createInterviewSet(
  data: CreateInterviewSetInput,
  _adminId?: string,
): Promise<{ id: string }> {
  const existing = await prisma.aIInterviewSet.findUnique({
    where: { jobPostId: data.jobPostId },
    select: { id: true },
  });
  if (existing) {
    throw new QuestionBankError(
      "This job already has an interview set.",
      "JOB_TAKEN",
    );
  }

  const set = await prisma.aIInterviewSet.create({
    data: {
      jobPostId: data.jobPostId,
      title: data.title,
      description: data.description ?? null,
      maxDurationMinutes: data.maxDurationMinutes,
      questionTimeLimitSeconds: data.questionTimeLimitSeconds,
      isActive: data.isActive,
    },
    select: { id: true },
  });
  return set;
}

/** Update an interview set's settings. */
export async function updateInterviewSet(
  id: string,
  data: InterviewSetSettingsInput,
): Promise<void> {
  await prisma.aIInterviewSet.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description ?? null,
      maxDurationMinutes: data.maxDurationMinutes,
      questionTimeLimitSeconds: data.questionTimeLimitSeconds,
      isActive: data.isActive,
    },
  });
}

/** Append a question to an interview set (placed last). */
export async function addInterviewQuestion(
  setId: string,
  input: InterviewQuestionInput,
): Promise<AdminInterviewQuestion> {
  const last = await prisma.aIInterviewQuestion.findFirst({
    where: { interviewSetId: setId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  const created = await prisma.aIInterviewQuestion.create({
    data: {
      interviewSetId: setId,
      questionText: input.questionText,
      questionType: input.questionType,
      expectedKeywords: input.expectedKeywords,
      maxTimeSeconds: input.maxTimeSeconds,
      orderIndex: (last?.orderIndex ?? -1) + 1,
    },
  });
  return toAdminInterviewQuestion(created);
}

/** Update an interview question. */
export async function updateInterviewQuestion(
  id: string,
  input: InterviewQuestionInput,
): Promise<AdminInterviewQuestion> {
  const updated = await prisma.aIInterviewQuestion.update({
    where: { id },
    data: {
      questionText: input.questionText,
      questionType: input.questionType,
      expectedKeywords: input.expectedKeywords,
      maxTimeSeconds: input.maxTimeSeconds,
    },
  });
  return toAdminInterviewQuestion(updated);
}

/** Delete an interview question. */
export async function deleteInterviewQuestion(id: string): Promise<void> {
  await prisma.aIInterviewQuestion.delete({ where: { id } });
}

/** Persist a new interview-question order. */
export async function reorderInterviewQuestions(
  setId: string,
  orderedIds: string[],
): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.aIInterviewQuestion.updateMany({
        where: { id, interviewSetId: setId },
        data: { orderIndex: index },
      }),
    ),
  );
}
