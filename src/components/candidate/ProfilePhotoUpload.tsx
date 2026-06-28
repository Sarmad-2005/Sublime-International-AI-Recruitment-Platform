"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import { Camera, Loader2, Trash2, UserRound } from "lucide-react";
import "react-image-crop/dist/ReactCrop.css";

import { UPLOAD_LIMITS } from "@/lib/constants";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";

interface ProfilePhotoUploadProps {
  /** Current photo URL (or `null`). */
  value: string | null;
  /** Called with the new URL after a successful upload, or `null` on remove. */
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

/** Center a square crop covering the largest possible area of the image. */
function centerSquareCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, 1, width, height),
    width,
    height,
  );
}

/**
 * Profile photo upload with square crop (react-image-crop) + uploadthing.
 * Validates the source image is at least 300×300px and only accepts JPG/PNG.
 */
export function ProfilePhotoUpload({
  value,
  onChange,
  disabled,
}: ProfilePhotoUploadProps) {
  const t = useTranslations("candidate.photo");
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  const { startUpload, isUploading } = useUploadThing("profilePhoto", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.serverData.url ?? res?.[0]?.ufsUrl ?? null;
      if (url) {
        onChange(url);
        toast.success(t("change"));
      }
      closeCropper();
    },
    onUploadError: () => {
      toast.error(t("uploadError"));
    },
  });

  function pickFile() {
    inputRef.current?.click();
  }

  function onSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    const acceptedTypes: readonly string[] = UPLOAD_LIMITS.PHOTO_ACCEPTED_TYPES;
    if (!acceptedTypes.includes(file.type)) {
      toast.error(t("invalidType"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      // Validate minimum dimensions before opening the cropper.
      const probe = new window.Image();
      probe.onload = () => {
        if (
          probe.naturalWidth < UPLOAD_LIMITS.PHOTO_MIN_DIMENSION_PX ||
          probe.naturalHeight < UPLOAD_LIMITS.PHOTO_MIN_DIMENSION_PX
        ) {
          toast.error(t("tooSmall"));
          return;
        }
        setImgSrc(src);
      };
      probe.src = src;
    };
    reader.readAsDataURL(file);
  }

  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = event.currentTarget;
    setCrop(centerSquareCrop(width, height));
  }

  function closeCropper() {
    setImgSrc(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
  }

  async function applyCrop() {
    const image = imgRef.current;
    if (!image || !completedCrop) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const sw = completedCrop.width * scaleX;
    const sh = completedCrop.height * scaleY;

    if (sw < UPLOAD_LIMITS.PHOTO_MIN_DIMENSION_PX || sh < UPLOAD_LIMITS.PHOTO_MIN_DIMENSION_PX) {
      toast.error(t("tooSmall"));
      return;
    }

    const side = Math.min(1024, Math.round(Math.max(sw, sh)));
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      sw,
      sh,
      0,
      0,
      side,
      side,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) {
      toast.error(t("uploadError"));
      return;
    }

    const file = new File([blob], "profile-photo.jpg", { type: "image/jpeg" });
    await startUpload([file]);
  }

  return (
    <div className="flex items-center gap-5">
      {/* Current photo / placeholder */}
      <div className="bg-muted relative size-24 overflow-hidden rounded-full ring-2 ring-border">
        {value ? (
          <Image
            src={value}
            alt={t("alt")}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground grid size-full place-items-center">
            <UserRound className="size-10" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_LIMITS.PHOTO_ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={onSelectFile}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={pickFile}
          disabled={disabled || isUploading}
        >
          <Camera className="size-4" />
          {value ? t("change") : t("upload")}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onChange(null)}
            disabled={disabled || isUploading}
          >
            <Trash2 className="size-4" />
            {t("remove")}
          </Button>
        )}
      </div>

      {/* Crop modal */}
      {imgSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background w-full max-w-md space-y-4 rounded-xl p-5 shadow-xl">
            <div>
              <h3 className="font-semibold">{t("cropTitle")}</h3>
              <p className="text-muted-foreground text-sm">{t("cropHint")}</p>
            </div>

            <div className="flex max-h-[60vh] justify-center overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
                aspect={1}
                circularCrop
                keepSelection
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt=""
                  onLoad={onImageLoad}
                  className="max-h-[55vh] w-auto"
                />
              </ReactCrop>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeCropper}
                disabled={isUploading}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                variant="brand"
                onClick={applyCrop}
                disabled={isUploading || !completedCrop}
              >
                {isUploading && <Loader2 className="size-4 animate-spin" />}
                {isUploading ? t("uploading") : t("apply")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
