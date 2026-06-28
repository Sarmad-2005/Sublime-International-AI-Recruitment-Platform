"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

import { useUploadThing } from "@/lib/uploadthing";
import type { UpdateCandidateProfileInput } from "@/lib/validations";
import type { CandidateProfileDTO } from "@/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProfilePhotoUpload } from "@/components/candidate/ProfilePhotoUpload";
import { CVUpload } from "@/components/candidate/CVUpload";

interface DocumentsFormProps {
  profile: CandidateProfileDTO | null;
  onSave: (data: UpdateCandidateProfileInput) => Promise<unknown>;
  /** False until the profile row exists (documents can't be saved before then). */
  profileExists: boolean;
}

export function DocumentsForm({
  profile,
  onSave,
  profileExists,
}: DocumentsFormProps) {
  const t = useTranslations("candidate.profile");
  const td = useTranslations("candidate.profile.documents");

  /** Persist a single document field, surfacing success/error toasts. */
  async function save(data: UpdateCandidateProfileInput) {
    try {
      await onSave(data);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  }

  return (
    <div className="space-y-6">
      {!profileExists && (
        <p className="bg-amber-50 text-amber-800 rounded-md border border-amber-200 px-3 py-2 text-sm">
          {t("createFirstNotice")}
        </p>
      )}

      {/* Profile photo */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{td("photoHeading")}</h3>
        <p className="text-muted-foreground text-sm">{td("photoHint")}</p>
        <ProfilePhotoUpload
          value={profile?.profilePhotoUrl ?? null}
          onChange={(url) => save({ profilePhotoUrl: url ?? "" })}
          disabled={!profileExists}
        />
      </section>

      <Separator />

      {/* CV */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{td("cvHeading")}</h3>
        <p className="text-muted-foreground text-sm">{td("cvHint")}</p>
        <CVUpload
          value={profile?.cvUrl ?? null}
          uploadedAt={profile?.cvUploadedAt ?? null}
          onChange={(url) => save({ cvUrl: url ?? "" })}
          disabled={!profileExists}
        />
      </section>

      <Separator />

      {/* Passport copy */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{td("passportHeading")}</h3>
        <p className="text-muted-foreground text-sm">{td("passportHint")}</p>
        <PassportUpload
          value={profile?.passportCopyUrl ?? null}
          onChange={(url) => save({ passportCopyUrl: url ?? "" })}
          disabled={!profileExists}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passport copy uploader (image or PDF)
// ---------------------------------------------------------------------------

function PassportUpload({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("candidate.cv");
  const inputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("passportCopy", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.serverData.url ?? res?.[0]?.ufsUrl ?? null;
      if (url) onChange(url);
    },
    onUploadError: () => {
      toast.error(t("uploadError"));
    },
  });

  function onSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void startUpload([file]);
  }

  const fileName = value
    ? decodeURIComponent(value.split("/").pop() ?? "passport")
    : null;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={onSelectFile}
        disabled={disabled}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="bg-royal/10 text-royal grid size-10 shrink-0 place-items-center rounded-md">
            <FileText className="size-5" />
          </div>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{fileName}</p>
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
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {isUploading ? t("uploading") : t("dropHere")}
        </Button>
      )}
    </div>
  );
}
