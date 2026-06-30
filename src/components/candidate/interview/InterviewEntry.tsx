"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  Gauge,
  Loader2,
  ShieldCheck,
  Video,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ApiResponse, InterviewEntryDTO, InterviewIdentityResult, InterviewSessionDTO } from "@/types";

import { AudioMeter } from "./AudioMeter";

interface InterviewEntryProps {
  entry: InterviewEntryDTO;
}

type MediaState = "idle" | "requesting" | "ready" | "denied";

/** Quality bands for the latency probe. */
function latencyLabel(ms: number | null): { text: string; tone: string } {
  if (ms == null) return { text: "Not tested", tone: "text-muted-foreground" };
  if (ms < 150) return { text: `${ms} ms · Excellent`, tone: "text-emerald-600" };
  if (ms < 400) return { text: `${ms} ms · Good`, tone: "text-amber-600" };
  return { text: `${ms} ms · Slow`, tone: "text-red-600" };
}

/**
 * AI-interview entry / device-check screen (SRS M5). Verifies camera + mic, runs
 * a latency probe, captures the CNIC identity snapshot, takes recording consent,
 * then begins the interview and navigates into the live session. The media
 * stream is acquired here for the checks and released on navigation; the session
 * page re-acquires its own.
 */
export function InterviewEntry({ entry }: InterviewEntryProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaState, setMediaState] = useState<MediaState>("idle");
  const [cameraReady, setCameraReady] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [testingLatency, setTestingLatency] = useState(false);
  const [identityUrl, setIdentityUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [starting, setStarting] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // ---- Acquire camera + mic --------------------------------------------
  const requestMedia = useCallback(async () => {
    setMediaState("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = media;
      setStream(media);
      setCameraReady(media.getVideoTracks().length > 0);
      setMediaState("ready");
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setMediaState("denied");
      setCameraReady(false);
    }
  }, []);

  useEffect(() => {
    void requestMedia();
    return () => stopStream();
  }, [requestMedia, stopStream]);

  // ---- Latency probe ----------------------------------------------------
  const runLatencyTest = useCallback(async () => {
    setTestingLatency(true);
    const samples: number[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await fetch(`${window.location.origin}/favicon.ico?_=${Date.now()}-${i}`, {
          method: "HEAD",
          cache: "no-store",
        });
        samples.push(performance.now() - start);
      }
      setLatencyMs(Math.round(samples.reduce((a, b) => a + b, 0) / samples.length));
    } catch {
      setLatencyMs(null);
    } finally {
      setTestingLatency(false);
    }
  }, []);

  useEffect(() => {
    if (mediaState === "ready") void runLatencyTest();
  }, [mediaState, runLatencyTest]);

  // ---- Identity snapshot ------------------------------------------------
  async function captureIdentity() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;
    setCapturing(true);
    try {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      const res = await fetch(`/api/interview/${entry.token}/identity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const json = (await res.json()) as ApiResponse<InterviewIdentityResult>;
      if (!json.success) throw new Error(json.error.message);
      setIdentityUrl(json.data.identityPhotoUrl);
      toast.success("Identity photo captured.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't capture the photo.");
    } finally {
      setCapturing(false);
    }
  }

  // ---- Start ------------------------------------------------------------
  const canStart =
    mediaState === "ready" && cameraReady && consent && identityUrl != null && !starting;

  async function handleStart() {
    if (!canStart) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/interview/${entry.token}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true,
          deviceCheck: {
            camera: cameraReady,
            microphone: stream?.getAudioTracks().length ? true : false,
            latencyMs,
          },
          identityPhotoUrl: null,
        }),
      });
      const json = (await res.json()) as ApiResponse<InterviewSessionDTO>;
      if (!json.success) throw new Error(json.error.message);
      stopStream();
      router.push(`/interview/${entry.token}/session`);
    } catch (error) {
      setStarting(false);
      toast.error(error instanceof Error ? error.message : "Couldn't start the interview.");
    }
  }

  const latency = latencyLabel(latencyMs);

  return (
    <div className="bg-muted/30 min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="text-center">
          <p className="text-royal text-sm font-semibold">Sublime International</p>
          <h1 className="mt-1 text-2xl font-bold">AI Interview — {entry.jobTitle}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Hi {entry.candidateName.split(" ")[0]}, let&apos;s check your setup before we
            begin. This interview has {entry.questionCount}{" "}
            {entry.questionCount === 1 ? "question" : "questions"} (~
            {entry.maxDurationMinutes} min).
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="size-4" /> Camera &amp; microphone
            </CardTitle>
            <CardDescription>
              We record your video and audio for this interview. Find a quiet,
              well-lit space.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-foreground/90 relative aspect-video w-full overflow-hidden rounded-lg">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              {mediaState !== "ready" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                  {mediaState === "requesting" && (
                    <>
                      <Loader2 className="size-6 animate-spin" />
                      <p className="text-sm">Requesting camera &amp; microphone…</p>
                    </>
                  )}
                  {mediaState === "denied" && (
                    <>
                      <XCircle className="size-6 text-red-400" />
                      <p className="max-w-xs text-center text-sm">
                        Camera/microphone access was blocked. Enable it in your
                        browser, then retry.
                      </p>
                      <Button size="sm" variant="secondary" onClick={() => void requestMedia()}>
                        Retry
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <CheckRow ok={cameraReady} label="Camera" icon={<Camera className="size-4" />} />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium">Microphone</span>
                <AudioMeter stream={stream} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                  <Gauge className="size-3.5" /> Connection
                </span>
                <span className={cn("text-sm font-medium", latency.tone)}>
                  {testingLatency ? "Testing…" : latency.text}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Identity verification
            </CardTitle>
            <CardDescription>
              Hold your CNIC up to the camera so it&apos;s clearly readable, then
              capture a snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={() => void captureIdentity()}
              disabled={!cameraReady || capturing}
            >
              {capturing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {identityUrl ? "Retake photo" : "Capture CNIC"}
            </Button>
            {identityUrl ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={identityUrl}
                  alt="Captured identity"
                  className="h-16 w-24 rounded border object-cover"
                />
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <CheckCircle2 className="size-4" /> Captured
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">No photo captured yet.</span>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="consent" className="text-sm leading-snug font-normal">
                I consent to this interview being recorded and used for recruitment
                purposes by Sublime International.
              </Label>
            </div>

            <Button
              variant="brand"
              size="lg"
              className="w-full"
              onClick={() => void handleStart()}
              disabled={!canStart}
            >
              {starting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Video className="size-4" />
              )}
              {starting ? "Starting…" : "Start Interview"}
            </Button>
            {!canStart && !starting && (
              <p className="text-muted-foreground text-center text-xs">
                Enable your camera &amp; mic, capture your CNIC, and accept the
                recording consent to begin.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CheckRow({
  ok,
  label,
  icon,
}: {
  ok: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
        {icon} {label}
      </span>
      <span
        className={cn(
          "flex items-center gap-1 text-sm font-medium",
          ok ? "text-emerald-600" : "text-muted-foreground",
        )}
      >
        {ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
        {ok ? "Ready" : "Waiting"}
      </span>
    </div>
  );
}
