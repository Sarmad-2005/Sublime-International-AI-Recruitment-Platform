"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { UPLOAD_LIMITS } from "@/lib/constants";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";

interface CVUploadProps {
  /** Current CV URL (or `null`). */
  value: string | null;
  /** ISO timestamp the current CV was uploaded (for display). */
  uploadedAt: string | null;
  /** Called with the new URL after upload, or `null` on remove. */
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

/**
 * Drag-and-drop CV upload (PDF/DOCX, max 5 MB) backed by uploadthing. Shows the
 * uploaded filename + date and offers replace / remove.
 */
export function CVUpload({
  value,
  uploadedAt,
  onChange,
  disabled,
}: CVUploadProps) {
  const t = useTranslations("candidate.cv");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { startUpload, isUploading } = useUploadThing("candidateCv", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.serverData.url ?? res?.[0]?.ufsUrl ?? null;
      if (url) onChange(url);
    },
    onUploadError: () => {
      toast.error(t("uploadError"));
    },
  });

  function validateAndUpload(file: File) {
    const acceptedTypes: readonly string[] = UPLOAD_LIMITS.CV_ACCEPTED_TYPES;
    if (!acceptedTypes.includes(file.type)) {
      toast.error(t("invalidType"));
      return;
    }
    if (file.size > UPLOAD_LIMITS.CV_MAX_BYTES) {
      toast.error(t("tooLarge"));
      return;
    }
    void startUpload([file]);
  }

  function onSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) validateAndUpload(file);
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (disabled || isUploading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) validateAndUpload(file);
  }

  const fileName = value ? decodeURIComponent(value.split("/").pop() ?? "CV") : null;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={onSelectFile}
        disabled={disabled}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="bg-royal/10 text-royal grid size-10 shrink-0 place-items-center rounded-md">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fileName}</p>
            {uploadedAt && (
              <p className="text-muted-foreground text-xs">
                {t("uploadedOn", {
                  date: format(new Date(uploadedAt), "d MMM yyyy"),
                })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button asChild variant="ghost" size="sm">
              <a href={value} target="_blank" rel="noopener noreferrer">
                {t("view")}
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || isUploading}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {t("replace")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => onChange(null)}
              disabled={disabled || isUploading}
              aria-label={t("remove")}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) {
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            dragOver ? "border-royal bg-royal/5" : "border-input hover:bg-accent/50",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="text-royal size-6 animate-spin" />
              <p className="text-sm font-medium">{t("uploading")}</p>
            </>
          ) : (
            <>
              <div className="bg-muted text-muted-foreground grid size-10 place-items-center rounded-full">
                <Upload className="size-5" />
              </div>
              <p className="text-sm font-medium">{t("dropHere")}</p>
              <p className="text-muted-foreground text-xs">{t("constraints")}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
