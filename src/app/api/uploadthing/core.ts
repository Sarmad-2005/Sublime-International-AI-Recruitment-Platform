import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { authService } from "@/lib/services";
import { USER_ROLES } from "@/lib/constants";

/**
 * uploadthing file router for candidate documents (SRS §3.3.2 FR-CAND-002).
 *
 * Every route is gated to the signed-in candidate via `getCurrentUser` in the
 * middleware (server-side — the session can't be spoofed). The upload only
 * returns the file URL; persisting it onto the candidate profile happens through
 * the normal `PATCH /api/candidate/profile` save so each profile tab still owns
 * its own write.
 */
const f = createUploadthing();

/** Reject anyone who isn't a signed-in candidate. */
async function candidateOnly() {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.CANDIDATE) {
    throw new UploadThingError("You must be signed in as a candidate to upload.");
  }
  return { userId: user.id };
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const candidateFileRouter = {
  /** Square profile photo (cropped client-side before upload). */
  profilePhoto: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(candidateOnly)
    .onUploadComplete(({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),

  /** CV / resume — PDF or DOCX, max 5 MB. */
  candidateCv: f({
    "application/pdf": { maxFileSize: "8MB", maxFileCount: 1 },
    [DOCX_MIME]: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(candidateOnly)
    .onUploadComplete(({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),

  /** Passport copy — scanned image or PDF. */
  passportCopy: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
    "application/pdf": { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(candidateOnly)
    .onUploadComplete(({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type CandidateFileRouter = typeof candidateFileRouter;
