import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

/**
 * Supabase Storage I/O for AI-interview artefacts (SRS M5) — identity snapshots
 * and the session recording. All objects live in a private bucket; callers get
 * back the durable object path (persisted) plus a short-lived signed URL for
 * immediate preview/playback. Server-only (uses the service-role client).
 *
 * The recording is uploaded as ordered chunks while the interview runs (every
 * ~30s, for resilience) and stitched into one continuous WebM on finalize —
 * MediaRecorder timeslice chunks concatenate losslessly because only the first
 * carries the container header.
 */

const BUCKET = serverEnv.INTERVIEW_RECORDINGS_BUCKET;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CHUNK_PREFIX = "chunks";

function admin() {
  return createSupabaseAdminClient();
}

let bucketEnsured = false;

/** Create the private bucket on first use (idempotent, best-effort). */
async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const supabase = admin();
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    await supabase.storage.createBucket(BUCKET, { public: false });
  }
  bucketEnsured = true;
}

/**
 * Sign an object path for temporary read access (null on failure). Pass a
 * custom `ttlSeconds` for shorter-lived links — e.g. client recording previews
 * use a 6-hour expiry (SRS §3.8 FR-CLIENT-004).
 */
export async function signedUrl(
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data } = await admin()
    .storage.from(BUCKET)
    .createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}

/** Signed-URL lifetime for a client recording preview — 6 hours. */
export const CLIENT_RECORDING_TTL_SECONDS = 60 * 60 * 6;

interface DataUrl {
  contentType: string;
  ext: string;
  bytes: Buffer;
}

function parseImageDataUrl(dataUrl: string): DataUrl {
  const match = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data URL.");
  const contentType = match[1]!;
  const ext = match[2] === "jpeg" ? "jpg" : match[2]!;
  return { contentType, ext, bytes: Buffer.from(match[3]!, "base64") };
}

export interface StoredObject {
  path: string;
  signedUrl: string | null;
}

/** Upload the CNIC identity snapshot for an attempt. Overwrites on re-capture. */
export async function uploadIdentitySnapshot(
  attemptId: string,
  imageDataUrl: string,
): Promise<StoredObject> {
  await ensureBucket();
  const { contentType, ext, bytes } = parseImageDataUrl(imageDataUrl);
  const path = `${attemptId}/identity.${ext}`;

  const { error } = await admin()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Identity upload failed: ${error.message}`);

  return { path, signedUrl: await signedUrl(path) };
}

/** Upload one recording chunk. Index is zero-padded so lexical sort = order. */
export async function uploadRecordingChunk(
  attemptId: string,
  chunkIndex: number,
  bytes: Buffer,
  contentType = "video/webm",
): Promise<string> {
  await ensureBucket();
  const name = String(chunkIndex).padStart(5, "0");
  const path = `${attemptId}/${CHUNK_PREFIX}/${name}.webm`;

  const { error } = await admin()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Chunk upload failed: ${error.message}`);

  return path;
}

/**
 * Concatenate every uploaded chunk into one `recording.webm` and return its
 * path + signed URL. Returns null when no chunks were ever uploaded (e.g. the
 * browser couldn't record).
 */
export async function finalizeRecording(
  attemptId: string,
): Promise<StoredObject | null> {
  await ensureBucket();
  const supabase = admin();
  const dir = `${attemptId}/${CHUNK_PREFIX}`;

  const { data: entries, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(dir, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (listError) throw new Error(`Listing chunks failed: ${listError.message}`);
  if (!entries || entries.length === 0) return null;

  const ordered = [...entries]
    .filter((e) => e.name.endsWith(".webm"))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Download chunks in parallel (order preserved by the array), then drop any
  // that failed rather than aborting the whole stitch.
  const downloaded = await Promise.all(
    ordered.map(async (entry) => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(`${dir}/${entry.name}`);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    }),
  );
  const buffers = downloaded.filter((b): b is NonNullable<typeof b> => b !== null);
  if (buffers.length === 0) return null;

  const path = `${attemptId}/recording.webm`;
  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.concat(buffers), {
      contentType: "video/webm",
      upsert: true,
    });
  if (upError) throw new Error(`Recording finalize failed: ${upError.message}`);

  return { path, signedUrl: await signedUrl(path) };
}
