"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Save, X } from "lucide-react";

import {
  AI_INTERVIEW_QUESTION_TYPE_LABELS,
  AI_INTERVIEW_QUESTION_TYPE_VALUES,
  type AIInterviewQuestionTypeValue,
} from "@/lib/constants";
import {
  interviewQuestionSchema,
  type InterviewQuestionInput,
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
import { KeywordTagInput } from "@/components/admin/questions";
import type { AdminInterviewQuestion } from "@/types";

interface InterviewQuestionFormProps {
  initial?: AdminInterviewQuestion;
  defaultMaxTime: number;
  saving?: boolean;
  onSave: (input: InterviewQuestionInput) => Promise<void> | void;
  onCancel: () => void;
}

export function InterviewQuestionForm({
  initial,
  defaultMaxTime,
  saving,
  onSave,
  onCancel,
}: InterviewQuestionFormProps) {
  const [questionType, setQuestionType] = useState<AIInterviewQuestionTypeValue>(
    (initial?.questionType as AIInterviewQuestionTypeValue) ?? "TECHNICAL",
  );
  const [questionText, setQuestionText] = useState(initial?.questionText ?? "");
  const [expectedKeywords, setExpectedKeywords] = useState<string[]>(
    initial?.expectedKeywords ?? [],
  );
  const [maxTimeSeconds, setMaxTimeSeconds] = useState(
    initial?.maxTimeSeconds ?? defaultMaxTime,
  );
  const [errors, setErrors] = useState<string[]>([]);

  async function handleSave() {
    const parsed = interviewQuestionSchema.safeParse({
      questionType,
      questionText,
      expectedKeywords,
      maxTimeSeconds,
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
      <h3 className="text-sm font-semibold">
        {initial ? "Edit Question" : "New Question"}
      </h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label className="mb-1 block text-sm">Category</Label>
          <Select
            value={questionType}
            onValueChange={(v) => setQuestionType(v as AIInterviewQuestionTypeValue)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_INTERVIEW_QUESTION_TYPE_VALUES.map((t) => (
                <SelectItem key={t} value={t}>
                  {AI_INTERVIEW_QUESTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block text-sm">Max Time (seconds)</Label>
          <Input
            type="number"
            min={15}
            max={600}
            value={maxTimeSeconds}
            onChange={(e) => setMaxTimeSeconds(Number(e.target.value) || defaultMaxTime)}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1 block text-sm">
          Question Text <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="e.g. Describe a time you resolved a conflict on-site."
          rows={3}
        />
      </div>

      <div>
        <Label className="mb-1 block text-sm">Expected Keywords</Label>
        <KeywordTagInput
          value={expectedKeywords}
          onChange={setExpectedKeywords}
          placeholder="Add keywords the AI should look for…"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Used to guide AI scoring. Optional — leave empty for open-ended
          qualitative scoring.
        </p>
      </div>

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
          className="bg-royal hover:bg-royal/90 gap-1.5 text-white"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {initial ? "Save Question" : "Add Question"}
        </Button>
      </div>
    </div>
  );
}
