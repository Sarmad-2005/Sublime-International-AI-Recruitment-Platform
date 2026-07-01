"use client";

import { useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface InterviewRecordingPlayerProps {
  url: string | null;
  className?: string;
}

export function InterviewRecordingPlayer({
  url,
  className,
}: InterviewRecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  if (!url) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm",
          className,
        )}
      >
        No recording available for this interview.
      </div>
    );
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
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

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-black", className)}>
      {/* Disable right-click and download controls */}
      <video
        ref={videoRef}
        src={url}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="w-full"
      />
      <div className="flex items-center gap-2 px-3 py-2">
        <Button size="icon" variant="ghost" onClick={togglePlay} className="size-8 text-white">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={toggleMute} className="size-8 text-white">
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>
        <span className="text-xs text-white/60 select-none">
          Secure preview — download disabled
        </span>
      </div>
    </div>
  );
}
