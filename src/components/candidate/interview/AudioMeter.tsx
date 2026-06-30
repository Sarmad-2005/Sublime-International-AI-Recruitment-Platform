"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";

interface AudioMeterProps {
  /** Live microphone stream, or null while acquiring / denied. */
  stream: MediaStream | null;
  className?: string;
}

/**
 * Live microphone level meter (SRS M5 device check). Taps the stream with a Web
 * Audio `AnalyserNode` and renders a 0–100% bar via rAF. Self-cleans the audio
 * graph on unmount or stream change so we never leak an `AudioContext`.
 */
export function AudioMeter({ stream, className }: AudioMeterProps) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      // RMS of the centered waveform → 0..1, scaled for visibility.
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(100, Math.round(rms * 280)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      void ctx.close();
    };
  }, [stream]);

  const active = level > 6;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {active ? (
        <Mic className="size-4 text-emerald-600" />
      ) : (
        <MicOff className="text-muted-foreground size-4" />
      )}
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-75"
          style={{ width: `${level}%` }}
        />
      </div>
    </div>
  );
}
