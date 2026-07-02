"use client";

import { useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { UPLOAD_LIMITS } from "@/lib/constants";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  /** Compact variant for answer-option thumbnails. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Admin image upload for assessment questions / answer options. Uploads via the
 * `assessmentImage` uploadthing route (admin-gated) and returns the stored URL.
 */
export function ImageUpload({
  value,
  onChange,
  disabled,
  size = "md",
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("assessmentImage", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.serverData.url ?? res?.[0]?.ufsUrl ?? null;
      if (url) {
        onChange(url);
        toast.success("Image uploaded");
      }
    },
    onUploadError: () => {
      toast.error("Image upload failed");
    },
  });

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const accepted: readonly string[] = UPLOAD_LIMITS.PHOTO_ACCEPTED_TYPES;
    if (!accepted.includes(file.type)) {
      toast.error("Only JPG or PNG images are allowed");
      return;
    }
    void startUpload([file]);
  }

  const dimension = size === "sm" ? "size-16" : "h-40 w-full max-w-sm";

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_LIMITS.PHOTO_ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={onSelectFile}
        disabled={disabled}
      />

      {value ? (
        <div className={cn("bg-muted relative overflow-hidden rounded-md border", dimension)}>
          <Image src={value} alt="" fill sizes="384px" className="object-contain" />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="bg-background/90 hover:bg-background absolute top-1 right-1 grid size-6 place-items-center rounded-full border shadow-sm"
              aria-label="Remove image"
            >
              <Trash2 className="text-destructive size-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className={cn(
            "border-input text-muted-foreground hover:border-royal hover:text-royal grid place-items-center rounded-md border border-dashed transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            dimension,
          )}
        >
          {isUploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs">
              <ImagePlus className={size === "sm" ? "size-4" : "size-6"} />
              {size === "md" && "Upload image"}
            </span>
          )}
        </button>
      )}

      {value && !disabled && size === "md" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          Replace
        </Button>
      )}
    </div>
  );
}
