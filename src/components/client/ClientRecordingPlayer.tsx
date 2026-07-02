"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play, ShieldCheck, Volume2, VolumeX } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ClientRecordingPlayerProps {
  url: string | null;
  /** Company name shown in the anti-piracy watermark overlay. */
  companyName: string;
  className?: string;
}

/**
 * Secure AI-interview recording player for the client portal.
 *
 * - Streams from a short-lived signed URL (minted server-side, 6-hour expiry).
 * - No download, no picture-in-picture, no native seek bar (custom controls).
 * - A CSS watermark overlay ("[Company] | Viewed on [Date]") deters screen
 *   recording without altering the source video (SRS §3.8 FR-CLIENT-004).
 */
export function ClientRecordingPlayer({
  url,
  companyName,
  className,
}: ClientRecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  // Set on the client to avoid a hydration mismatch on the "viewed on" date.
  const [viewedOn, setViewedOn] = useState<string>("");

  useEffect(() => {
    setViewedOn(format(new Date(), "d MMM yyyy"));
  }, []);

  if (!url) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex h-56 items-center justify-center rounded-lg border border-dashed text-sm",
          className,
        )}
      >
        No interview recording is available for this candidate yet.
      </div>
    );
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function goFullscreen() {
    void videoRef.current?.requestFullscreen?.();
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-black", className)}>
      <div className="relative">
        <video
          ref={videoRef}
          src={url}
          controlsList="nodownload noremoteplayback noplaybackrate"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="aspect-video w-full"
        />

        {/* Repeating watermark overlay — pointer-events-none so it never blocks
            the controls beneath it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-wrap content-around justify-around gap-8 overflow-hidden opacity-20 select-none"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="rotate-[-24deg] text-xs font-semibold whitespace-nowrap text-white"
            >
              {companyName} · Viewed on {viewedOn}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={togglePlay}
          className="size-8 text-white hover:bg-white/10 hover:text-white"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleMute}
          className="size-8 text-white hover:bg-white/10 hover:text-white"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>
        <span className="ml-1 flex items-center gap-1.5 text-xs text-white/60 select-none">
          <ShieldCheck className="size-3.5" />
          Secure preview — download disabled
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={goFullscreen}
          className="ml-auto size-8 text-white hover:bg-white/10 hover:text-white"
          aria-label="Fullscreen"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
