"use client";

import { useState, useTransition } from "react";
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
        toast.success("Note added");
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
          placeholder="Add an internal admin note…"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            Admin-only. Not visible to candidates or Saudi clients.
          </span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || text.trim().length < MIN_NOTE}
          >
            <MessageSquarePlus className="size-4" />
            {isPending ? "Saving…" : "Add Note"}
          </Button>
        </div>
      </div>

      {/* Notes history */}
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No notes yet.
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-md border bg-muted/30 px-4 py-3 space-y-1"
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.note}</p>
              <p className="text-muted-foreground text-xs">
                {format(new Date(note.createdAt), "d MMM yyyy 'at' HH:mm")}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
