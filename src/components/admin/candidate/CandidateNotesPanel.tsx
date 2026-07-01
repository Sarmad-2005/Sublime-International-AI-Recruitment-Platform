"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNoteAction } from "@/app/(admin)/admin/candidates/actions";
import type { AdminCandidateNote } from "@/types";

interface CandidateNotesPanelProps {
  candidateId: string;
  initialNotes: AdminCandidateNote[];
}

export function CandidateNotesPanel({
  candidateId,
  initialNotes,
}: CandidateNotesPanelProps) {
  const t = useTranslations("admin.candidates.notes");
  const [notes, setNotes] = useState<AdminCandidateNote[]>(initialNotes);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const MIN_NOTE = 3;

  function handleSubmit() {
    if (text.trim().length < MIN_NOTE) return;
    startTransition(async () => {
      const result = await addNoteAction(candidateId, text);
      if (result.ok) {
        setNotes((prev) => [result.data, ...prev]);
        setText("");
        toast.success(t("addedToast"));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Add note */}
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("placeholder")}
          rows={3}
        />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {t("adminOnly")}
          </span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || text.trim().length < MIN_NOTE}
          >
            <MessageSquarePlus className="size-4" />
            {isPending ? t("saving") : t("add")}
          </Button>
        </div>
      </div>

      {/* Notes history */}
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-md border bg-muted/30 px-4 py-3 space-y-1"
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.note}</p>
              <p className="text-muted-foreground text-xs">
                {t("at", {
                  date: format(new Date(note.createdAt), "d MMM yyyy"),
                  time: format(new Date(note.createdAt), "HH:mm"),
                })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
