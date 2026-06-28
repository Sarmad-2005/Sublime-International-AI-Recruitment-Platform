import {
  generateReactHelpers,
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";

import type { CandidateFileRouter } from "@/app/api/uploadthing/core";

/**
 * Typed uploadthing client helpers, bound to the candidate file router. Import
 * `useUploadThing` for headless uploads (custom UI), or the pre-built
 * `UploadButton` / `UploadDropzone` components.
 */
export const { useUploadThing, uploadFiles } =
  generateReactHelpers<CandidateFileRouter>();

export const UploadButton = generateUploadButton<CandidateFileRouter>();
export const UploadDropzone = generateUploadDropzone<CandidateFileRouter>();
