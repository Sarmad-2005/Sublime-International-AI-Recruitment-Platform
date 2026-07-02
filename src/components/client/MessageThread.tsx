"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { format, isSameDay } from "date-fns";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Paperclip,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendClientMessageAction } from "@/app/(client)/actions";
import type { ClientMessageDTO } from "@/types";

/** Max attachment size enforced client-side (documents) — SRS M11: 10 MB. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];

interface PendingAttachment {
  url: string;
  name: string;
}

interface MessageThreadProps {
  initialMessages: ClientMessageDTO[];
  clientUserId: string;
}

/**
 * Client ↔ team conversation. Renders message bubbles (client right, team left),
 * a composer with document attachments, and a Supabase Realtime subscription so
 * inbound team replies appear live.
 */
export function MessageThread({
  initialMessages,
  clientUserId,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<ClientMessageDTO[]>(initialMessages);
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (state, next: ClientMessageDTO) => [...state, next],
  );
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { startUpload, isUploading } = useUploadThing(
    "clientMessageAttachment",
    {
      onClientUploadComplete: (res) => {
        const first = res?.[0];
        const url = first?.serverData.url ?? first?.ufsUrl;
        const name = first?.serverData.name ?? first?.name ?? "attachment";
        if (url) setAttachment({ url, name });
      },
      onUploadError: () => {
        toast.error("Upload failed. Please try again.");
      },
    },
  );

  /** Append a message, de-duplicating by id (send + realtime can race). */
  function upsert(message: ClientMessageDTO) {
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message],
    );
  }

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimistic.length]);

  // Supabase Realtime — live inbound (team → client) messages.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`messages:${clientUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${clientUserId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            content: string;
            attachment_url: string | null;
            attachment_name: string | null;
            sender_id: string;
            is_read: boolean;
            sent_at: string;
          };
          upsert({
            id: row.id,
            content: row.content,
            attachmentUrl: row.attachment_url,
            attachmentName: row.attachment_name,
            senderId: row.sender_id,
            fromClient: row.sender_id === clientUserId,
            isRead: row.is_read,
            sentAt: row.sent_at,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientUserId]);

  function onSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Only PDF, Word or image files are allowed.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Files must be 10 MB or smaller.");
      return;
    }
    void startUpload([file]);
  }

  function handleSend() {
    const text = content.trim();
    if (!text && !attachment) return;
    if (pending || isUploading) return;

    const optimisticMessage: ClientMessageDTO = {
      id: `optimistic-${Date.now()}`,
      content: text,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      senderId: clientUserId,
      fromClient: true,
      isRead: false,
      sentAt: new Date().toISOString(),
    };

    startTransition(async () => {
      addOptimistic(optimisticMessage);
      const result = await sendClientMessageAction({
        content: text,
        attachmentUrl: attachment?.url ?? null,
        attachmentName: attachment?.name ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      upsert(result.data);
      setContent("");
      setAttachment(null);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="bg-card flex h-[calc(100vh-11rem)] min-h-[26rem] flex-col overflow-hidden rounded-xl border">
      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {optimistic.length === 0 ? (
          <div className="text-muted-foreground grid h-full place-items-center text-center text-sm">
            <div className="space-y-1">
              <p className="font-medium">No messages yet</p>
              <p>Start the conversation with the Sublime International team.</p>
            </div>
          </div>
        ) : (
          optimistic.map((message, index) => {
            const prev = optimistic[index - 1];
            const showDate =
              !prev || !isSameDay(new Date(prev.sentAt), new Date(message.sentAt));
            return (
              <div key={message.id}>
                {showDate && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="bg-muted text-muted-foreground rounded-full px-3 py-0.5 text-xs">
                      {format(new Date(message.sentAt), "EEEE, d MMM yyyy")}
                    </span>
                  </div>
                )}
                <MessageBubble message={message} />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t p-3 sm:p-4">
        {attachment && (
          <div className="bg-muted mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
            <FileText className="text-royal size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove attachment"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={onSelectFile}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || pending}
            aria-label="Attach a document"
          >
            {isUploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Paperclip className="size-5" />
            )}
          </Button>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message…"
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-none"
          />
          <Button
            type="button"
            variant="brand"
            size="icon"
            className="shrink-0"
            onClick={handleSend}
            disabled={pending || isUploading || (!content.trim() && !attachment)}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" />
          The Sublime International team typically replies within 24 hours.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ClientMessageDTO }) {
  const mine = message.fromClient;
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[70%]",
          mine
            ? "bg-navy rounded-br-sm text-white"
            : "bg-muted rounded-bl-sm",
        )}
      >
        {message.content && (
          <p className="break-words whitespace-pre-wrap">{message.content}</p>
        )}
        {message.attachmentUrl && (
          <a
            href={message.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-1.5 flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium",
              mine ? "bg-white/10 hover:bg-white/20" : "bg-background hover:bg-accent",
            )}
          >
            <FileText className="size-4 shrink-0" />
            <span className="truncate">
              {message.attachmentName ?? "Attachment"}
            </span>
          </a>
        )}
        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            mine ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {format(new Date(message.sentAt), "h:mm a")}
        </p>
      </div>
    </div>
  );
}
