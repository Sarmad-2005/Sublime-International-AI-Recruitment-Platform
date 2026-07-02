"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, Save, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MIN_ANSWER_OPTIONS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_VALUES,
  SINGLE_ANSWER_QUESTION_TYPES,
  type QuestionTypeValue,
} from "@/lib/constants";
import { randomId } from "@/lib/utils/id";
import {
  assessmentQuestionSchema,
  type AssessmentQuestionInput,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/admin/jobs/RichTextEditor";
import { AnswerOptionBuilder } from "./AnswerOptionBuilder";
import { ImageUpload } from "./ImageUpload";
import { QuestionPreview } from "./QuestionPreview";
import type { AdminQuestion, AdminQuestionOption } from "@/types";

interface QuestionEditorProps {
  /** Existing question when editing; omit to author a new one. */
  initial?: AdminQuestion;
  onSave: (input: AssessmentQuestionInput) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
}

function blankOption(): AdminQuestionOption {
  return { id: randomId("opt"), text: "", imageUrl: null };
}

/** Full inline create/edit form for a single assessment question. */
export function QuestionEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: QuestionEditorProps) {
  const [type, setType] = useState<QuestionTypeValue>(
    (initial?.type as QuestionTypeValue) ?? "MCQ",
  );
  const [questionText, setQuestionText] = useState(initial?.questionText ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [options, setOptions] = useState<AdminQuestionOption[]>(
    initial?.options?.length
      ? initial.options
      : [blankOption(), blankOption()],
  );
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(
    initial?.correctAnswers ?? [],
  );
  const [points, setPoints] = useState(initial?.points ?? 1);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const isScenario = type === "SCENARIO";
  const isImageBased = type === "IMAGE_BASED";

  function changeType(next: QuestionTypeValue) {
    setType(next);
    // Collapse to a single correct answer when moving to a single-answer type.
    const nowSingle = (SINGLE_ANSWER_QUESTION_TYPES as readonly string[]).includes(
      next,
    );
    if (nowSingle && correctAnswers.length > 1) {
      setCorrectAnswers(correctAnswers.slice(0, 1));
    }
  }

  const draft: AssessmentQuestionInput | null = useMemo(() => {
    const parsed = assessmentQuestionSchema.safeParse({
      type,
      questionText,
      imageUrl,
      options,
      correctAnswers,
      points,
    });
    return parsed.success ? parsed.data : null;
  }, [type, questionText, imageUrl, options, correctAnswers, points]);

  async function handleSave() {
    const parsed = assessmentQuestionSchema.safeParse({
      type,
      questionText,
      imageUrl,
      options,
      correctAnswers,
      points,
    });
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    setErrors([]);
    await onSave(parsed.data);
  }

  return (
    <div className="bg-muted/30 space-y-5 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {initial ? "Edit Question" : "New Question"}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {preview ? "Edit" : "Preview"}
        </Button>
      </div>

      {preview ? (
        draft ? (
          <QuestionPreview question={draft} showCorrect />
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Fill in the question to see a preview.
          </p>
        )
      ) : (
        <div className="space-y-5">
          {/* Type + points */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm">Question Type</Label>
              <Select value={type} onValueChange={(v) => changeType(v as QuestionTypeValue)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPE_VALUES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {QUESTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm">Points</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={points}
                onChange={(e) => setPoints(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>

          {/* Question text */}
          <div>
            <Label className="mb-1 block text-sm">
              Question Text <span className="text-red-500">*</span>
            </Label>
            {isScenario ? (
              <RichTextEditor
                value={questionText}
                onChange={setQuestionText}
                placeholder="Describe the scenario the candidate must respond to…"
              />
            ) : (
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter the question…"
                rows={3}
              />
            )}
          </div>

          {/* Image (image-based) */}
          {isImageBased && (
            <div>
              <Label className="mb-1 block text-sm">
                Question Image <span className="text-red-500">*</span>
              </Label>
              <ImageUpload value={imageUrl} onChange={setImageUrl} />
            </div>
          )}

          {/* Options */}
          <AnswerOptionBuilder
            type={type}
            options={options}
            correctAnswers={correctAnswers}
            onOptionsChange={setOptions}
            onCorrectChange={setCorrectAnswers}
            withImages={isImageBased}
          />
        </div>
      )}

      {errors.length > 0 && (
        <div className="space-y-1 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.map((e, i) => (
            <p key={i} className="flex items-center gap-1.5">
              <AlertCircle className="size-3.5 shrink-0" />
              {e}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          <X className="size-4" />
          Cancel
        </Button>
        <Button
          type="button"
          className={cn("bg-royal hover:bg-royal/90 gap-1.5 text-white")}
          onClick={handleSave}
          disabled={saving || options.length < MIN_ANSWER_OPTIONS}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {initial ? "Save Question" : "Add Question"}
        </Button>
      </div>
    </div>
  );
}
