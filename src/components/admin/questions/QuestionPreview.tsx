"use client";

import Image from "next/image";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  QUESTION_TYPE_LABELS,
  SINGLE_ANSWER_QUESTION_TYPES,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import type { AdminQuestion, AdminQuestionOption } from "@/types";

interface QuestionPreviewProps {
  question: Pick<
    AdminQuestion,
    "type" | "questionText" | "imageUrl" | "options" | "correctAnswers" | "points"
  >;
  /** Index in the list (1-based) — shown as "Question N". */
  index?: number;
  /** Highlight the correct answer(s) with a check + green styling. */
  showCorrect?: boolean;
}

/**
 * Renders a question the way a candidate sees it during the assessment. When
 * `showCorrect` is on, the correct option(s) are highlighted — the admin answer
 * key view.
 */
export function QuestionPreview({
  question,
  index,
  showCorrect,
}: QuestionPreviewProps) {
  const isSingle = (SINGLE_ANSWER_QUESTION_TYPES as readonly string[]).includes(
    question.type,
  );
  const isScenario = question.type === "SCENARIO";

  return (
    <div className="space-y-4 rounded-lg border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {index != null && (
            <span className="text-muted-foreground text-sm font-semibold">
              Question {index}
            </span>
          )}
          <Badge variant="outline" className="text-xs">
            {QUESTION_TYPE_LABELS[question.type] ?? question.type}
          </Badge>
        </div>
        <span className="text-muted-foreground text-xs">
          {question.points} {question.points === 1 ? "point" : "points"}
        </span>
      </div>

      {/* Question text */}
      {isScenario ? (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: question.questionText }}
        />
      ) : (
        <p className="text-sm font-medium whitespace-pre-wrap">
          {question.questionText || (
            <span className="text-muted-foreground italic">No question text</span>
          )}
        </p>
      )}

      {/* Question image */}
      {question.imageUrl && (
        <div className="bg-muted relative h-52 w-full max-w-md overflow-hidden rounded-md border">
          <Image
            src={question.imageUrl}
            alt="Question"
            fill
            sizes="448px"
            className="object-contain"
          />
        </div>
      )}

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((option, i) => (
          <OptionRow
            key={option.id}
            option={option}
            letter={String.fromCharCode(65 + i)}
            isSingle={isSingle}
            correct={showCorrect && question.correctAnswers.includes(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

function OptionRow({
  option,
  letter,
  isSingle,
  correct,
}: {
  option: AdminQuestionOption;
  letter: string;
  isSingle: boolean;
  correct?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm",
        correct ? "border-green-300 bg-green-50" : "border-input",
      )}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center text-xs font-semibold",
          isSingle ? "rounded-full border" : "rounded border",
          correct ? "border-green-500 bg-green-500 text-white" : "text-muted-foreground",
        )}
      >
        {correct ? <Check className="size-3.5" /> : letter}
      </span>
      {option.imageUrl && (
        <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded border">
          <Image src={option.imageUrl} alt="" fill sizes="48px" className="object-contain" />
        </div>
      )}
      <span className={cn("min-w-0", correct && "font-medium text-green-800")}>
        {option.text || <span className="text-muted-foreground italic">Empty option</span>}
      </span>
    </div>
  );
}
