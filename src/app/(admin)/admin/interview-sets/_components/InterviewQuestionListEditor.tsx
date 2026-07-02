"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GripVertical, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { AI_INTERVIEW_QUESTION_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InterviewQuestionForm } from "./InterviewQuestionForm";
import { InterviewPreview } from "./InterviewPreview";
import type { InterviewQuestionInput } from "@/lib/validations";
import type { AdminInterviewQuestion, InterviewSetDetail } from "@/types";
import {
  addInterviewQuestionAction,
  deleteInterviewQuestionAction,
  reorderInterviewQuestionsAction,
  updateInterviewQuestionAction,
} from "../actions";

export function InterviewQuestionListEditor({ set }: { set: InterviewSetDetail }) {
  const [questions, setQuestions] = useState<AdminInterviewQuestion[]>(set.questions);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function handleAdd(input: InterviewQuestionInput) {
    setSaving(true);
    try {
      const result = await addInterviewQuestionAction(set.id, input);
      if (result.ok) {
        setQuestions((qs) => [...qs, result.data]);
        setAdding(false);
        toast.success("Question added");
      } else {
        toast.error(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, input: InterviewQuestionInput) {
    setSaving(true);
    try {
      const result = await updateInterviewQuestionAction(set.id, id, input);
      if (result.ok) {
        setQuestions((qs) => qs.map((q) => (q.id === id ? result.data : q)));
        setEditingId(null);
        toast.success("Question saved");
      } else {
        toast.error(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const prev = questions;
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    const result = await deleteInterviewQuestionAction(set.id, id);
    if (!result.ok) {
      setQuestions(prev);
      toast.error(result.error);
    } else {
      toast.success("Question deleted");
    }
  }

  async function persistOrder(ordered: AdminInterviewQuestion[]) {
    const result = await reorderInterviewQuestionsAction(
      set.id,
      ordered.map((q) => q.id),
    );
    if (!result.ok) toast.error(result.error);
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...questions];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved!);
    setQuestions(next);
    setDragIndex(null);
    void persistOrder(next);
  }

  // Keep the preview in sync with the live (unsaved-order) question list.
  const previewSet: InterviewSetDetail = { ...set, questions };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="text-muted-foreground size-4" />
          <h2 className="text-base font-semibold">
            Questions
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {questions.length}
            </span>
          </h2>
        </div>
        <div className="flex gap-2">
          <InterviewPreview set={previewSet} />
          <Button
            type="button"
            size="sm"
            className="bg-royal hover:bg-royal/90 gap-1.5 text-white"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            disabled={adding}
          >
            <Plus className="size-4" />
            Add Question
          </Button>
        </div>
      </div>

      {questions.length === 0 && !adding && (
        <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
          No questions yet. Add one to build the interview.
        </div>
      )}

      <ol className="space-y-2">
        {questions.map((question, index) =>
          editingId === question.id ? (
            <li key={question.id}>
              <InterviewQuestionForm
                initial={question}
                defaultMaxTime={set.questionTimeLimitSeconds}
                saving={saving}
                onSave={(input) => handleUpdate(question.id, input)}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={question.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className={cn(
                "flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 transition-colors hover:border-royal/40",
                dragIndex === index && "opacity-50",
              )}
            >
              <GripVertical className="text-muted-foreground size-4 shrink-0 cursor-grab active:cursor-grabbing" />
              <span className="text-muted-foreground w-5 shrink-0 text-center text-sm tabular-nums">
                {index + 1}
              </span>
              <Badge variant="outline" className="shrink-0 text-xs">
                {AI_INTERVIEW_QUESTION_TYPE_LABELS[question.questionType] ??
                  question.questionType}
              </Badge>
              <span className="line-clamp-1 min-w-0 flex-1 text-sm">
                {question.questionText}
              </span>
              {question.expectedKeywords.length > 0 && (
                <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                  {question.expectedKeywords.length} keyword
                  {question.expectedKeywords.length === 1 ? "" : "s"}
                </span>
              )}
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {question.maxTimeSeconds}s
              </span>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => {
                    setEditingId(question.id);
                    setAdding(false);
                  }}
                  title="Edit"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive size-8"
                  onClick={() => handleDelete(question.id)}
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ),
        )}
      </ol>

      {adding && (
        <InterviewQuestionForm
          defaultMaxTime={set.questionTimeLimitSeconds}
          saving={saving}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}
    </section>
  );
}
