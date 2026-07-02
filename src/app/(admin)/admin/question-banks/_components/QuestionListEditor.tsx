"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  GripVertical,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { QUESTION_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionEditor, CSVImporter } from "@/components/admin/questions";
import type { AssessmentQuestionInput } from "@/lib/validations";
import type { AdminQuestion } from "@/types";
import {
  addQuestionAction,
  deleteQuestionAction,
  importQuestionsAction,
  reorderQuestionsAction,
  updateQuestionAction,
} from "../actions";

/** Plain-text preview of a (possibly HTML) question body. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function QuestionListEditor({
  bankId,
  initialQuestions,
}: {
  bankId: string;
  initialQuestions: AdminQuestion[];
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<AdminQuestion[]>(initialQuestions);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function handleAdd(input: AssessmentQuestionInput) {
    setSaving(true);
    try {
      const result = await addQuestionAction(bankId, input);
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

  async function handleUpdate(questionId: string, input: AssessmentQuestionInput) {
    setSaving(true);
    try {
      const result = await updateQuestionAction(bankId, questionId, input);
      if (result.ok) {
        setQuestions((qs) => qs.map((q) => (q.id === questionId ? result.data : q)));
        setEditingId(null);
        toast.success("Question saved");
      } else {
        toast.error(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(questionId: string) {
    const prev = questions;
    setQuestions((qs) => qs.filter((q) => q.id !== questionId));
    const result = await deleteQuestionAction(bankId, questionId);
    if (!result.ok) {
      setQuestions(prev);
      toast.error(result.error);
    } else {
      toast.success("Question deleted");
    }
  }

  async function persistOrder(ordered: AdminQuestion[]) {
    const result = await reorderQuestionsAction(
      bankId,
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
          <CSVImporter
            onImport={async (csvText) => {
              const result = await importQuestionsAction(bankId, csvText);
              if (!result.ok) throw new Error(result.error);
              return result.data;
            }}
            onImported={() => router.refresh()}
          />
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
          No questions yet. Add one or import from CSV.
        </div>
      )}

      <ol className="space-y-2">
        {questions.map((question, index) =>
          editingId === question.id ? (
            <li key={question.id}>
              <QuestionEditor
                initial={question}
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
                "flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 transition-colors",
                dragIndex === index && "opacity-50",
                "hover:border-royal/40",
              )}
            >
              <GripVertical className="text-muted-foreground size-4 shrink-0 cursor-grab active:cursor-grabbing" />
              <span className="text-muted-foreground w-5 shrink-0 text-center text-sm tabular-nums">
                {index + 1}
              </span>
              <Badge variant="outline" className="shrink-0 text-xs">
                {QUESTION_TYPE_LABELS[question.type] ?? question.type}
              </Badge>
              <span className="line-clamp-1 min-w-0 flex-1 text-sm">
                {plainText(question.questionText) || (
                  <span className="text-muted-foreground italic">Untitled question</span>
                )}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {question.points} pt{question.points === 1 ? "" : "s"}
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
        <QuestionEditor
          saving={saving}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}
    </section>
  );
}
