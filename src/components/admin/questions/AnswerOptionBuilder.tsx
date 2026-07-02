"use client";

import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MAX_ANSWER_OPTIONS,
  MIN_ANSWER_OPTIONS,
  SINGLE_ANSWER_QUESTION_TYPES,
  type QuestionTypeValue,
} from "@/lib/constants";
import { randomId } from "@/lib/utils/id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "./ImageUpload";
import type { AdminQuestionOption } from "@/types";

interface AnswerOptionBuilderProps {
  type: QuestionTypeValue;
  options: AdminQuestionOption[];
  correctAnswers: string[];
  onOptionsChange: (options: AdminQuestionOption[]) => void;
  onCorrectChange: (correctAnswers: string[]) => void;
  /** Show a per-option image slot (image-based questions). */
  withImages?: boolean;
  disabled?: boolean;
}

/**
 * Dynamic answer-option editor (2–6 options). Correct answers are marked with
 * radios for single-answer types and checkboxes for multi-select. Removing an
 * option also clears it from the correct set.
 */
export function AnswerOptionBuilder({
  type,
  options,
  correctAnswers,
  onOptionsChange,
  onCorrectChange,
  withImages,
  disabled,
}: AnswerOptionBuilderProps) {
  const isSingle = (SINGLE_ANSWER_QUESTION_TYPES as readonly string[]).includes(
    type,
  );

  function updateOption(id: string, patch: Partial<AdminQuestionOption>) {
    onOptionsChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function addOption() {
    if (options.length >= MAX_ANSWER_OPTIONS) return;
    onOptionsChange([...options, { id: randomId("opt"), text: "", imageUrl: null }]);
  }

  function removeOption(id: string) {
    onOptionsChange(options.filter((o) => o.id !== id));
    onCorrectChange(correctAnswers.filter((c) => c !== id));
  }

  function toggleCorrect(id: string) {
    if (isSingle) {
      onCorrectChange([id]);
    } else if (correctAnswers.includes(id)) {
      onCorrectChange(correctAnswers.filter((c) => c !== id));
    } else {
      onCorrectChange([...correctAnswers, id]);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Answer Options
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            {isSingle
              ? "Select the one correct answer"
              : "Check all correct answers"}
          </span>
        </p>
        <span className="text-muted-foreground text-xs">
          {options.length}/{MAX_ANSWER_OPTIONS}
        </span>
      </div>

      <div className="space-y-2">
        {options.map((option, index) => {
          const checked = correctAnswers.includes(option.id);
          return (
            <div
              key={option.id}
              className={cn(
                "flex items-start gap-3 rounded-md border p-2.5 transition-colors",
                checked
                  ? "border-green-300 bg-green-50/60"
                  : "border-input bg-card",
              )}
            >
              <label className="mt-2 flex shrink-0 cursor-pointer items-center">
                <input
                  type={isSingle ? "radio" : "checkbox"}
                  name={isSingle ? "correct-answer" : undefined}
                  checked={checked}
                  onChange={() => toggleCorrect(option.id)}
                  disabled={disabled}
                  className="size-4 accent-green-600"
                  aria-label={`Mark option ${index + 1} correct`}
                />
              </label>

              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  value={option.text}
                  onChange={(e) => updateOption(option.id, { text: e.target.value })}
                  placeholder={`Option ${index + 1}`}
                  disabled={disabled}
                />
                {withImages && (
                  <ImageUpload
                    value={option.imageUrl}
                    onChange={(url) => updateOption(option.id, { imageUrl: url })}
                    size="sm"
                    disabled={disabled}
                  />
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                onClick={() => removeOption(option.id)}
                disabled={disabled || options.length <= MIN_ANSWER_OPTIONS}
                title={
                  options.length <= MIN_ANSWER_OPTIONS
                    ? `At least ${MIN_ANSWER_OPTIONS} options required`
                    : "Remove option"
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={addOption}
        disabled={disabled || options.length >= MAX_ANSWER_OPTIONS}
      >
        <Plus className="size-4" />
        Add Option
      </Button>
    </div>
  );
}
