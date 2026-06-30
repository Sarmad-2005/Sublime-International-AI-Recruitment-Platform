"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Check, ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AssessmentQuestionDTO } from "@/types";

/**
 * Plain `<img>` with a self-contained error fallback. Handling the load `error`
 * event locally is important: an unhandled resource error surfaces in dev as a
 * bare "[object Event]" runtime overlay, and a broken question image shouldn't
 * derail the assessment. Falls back to a small placeholder.
 */
function SafeImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "text-muted-foreground bg-muted/40 flex items-center justify-center gap-2 rounded-md border border-dashed py-6 text-xs",
          className,
        )}
      >
        <ImageOff className="size-4" />
        Image unavailable
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

interface QuestionCardProps {
  question: AssessmentQuestionDTO;
  /** 1-based position, for the "Question X" heading. */
  index: number;
  /** Currently selected option ids. */
  selected: string[];
  /** Called with the next selected option ids when the answer changes. */
  onChange: (optionIds: string[]) => void;
}

/**
 * Renders a single question of any supported type (MCQ, multi-select, scenario,
 * image-based). Single-answer types behave like radios; `MULTI_SELECT` toggles
 * multiple options. Images on the question and on options are shown when present.
 */
export function QuestionCard({
  question,
  index,
  selected,
  onChange,
}: QuestionCardProps) {
  const isMulti = question.type === "MULTI_SELECT";

  function toggle(optionId: string) {
    if (isMulti) {
      onChange(
        selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId],
      );
    } else {
      onChange([optionId]);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Question {index}
          {isMulti && " · select all that apply"}
        </p>
        <h2 className="text-lg font-semibold leading-snug text-balance">
          {question.questionText}
        </h2>
      </div>

      {question.imageUrl && (
        <SafeImage
          src={question.imageUrl}
          alt="Question illustration"
          className="max-h-72 w-full rounded-lg border object-contain"
        />
      )}

      <div
        role={isMulti ? "group" : "radiogroup"}
        className="grid gap-2.5 sm:grid-cols-2"
      >
        {question.options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role={isMulti ? "checkbox" : "radio"}
              aria-checked={checked}
              onClick={() => toggle(option.id)}
              className={cn(
                "group flex items-start gap-3 rounded-lg border-2 p-3.5 text-left transition-colors",
                "hover:border-royal/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                checked
                  ? "border-royal bg-royal/5"
                  : "border-input bg-background",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center border-2 transition-colors",
                  isMulti ? "rounded-md" : "rounded-full",
                  checked
                    ? "border-royal bg-royal text-white"
                    : "border-muted-foreground/40 bg-background",
                )}
              >
                {checked && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 space-y-2">
                {option.text && (
                  <span className="block text-sm font-medium">{option.text}</span>
                )}
                {option.imageUrl && (
                  <SafeImage
                    src={option.imageUrl}
                    alt={option.text || "Answer option"}
                    className="max-h-40 w-full rounded-md border object-contain"
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
