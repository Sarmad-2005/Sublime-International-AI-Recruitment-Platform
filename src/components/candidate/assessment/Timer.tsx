"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

/** mm:ss for a non-negative number of seconds. */
function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface TimerProps {
  /** ISO timestamp the timer expires (server-authoritative). */
  endsAt: string;
  /** Fired exactly once when the timer reaches zero. */
  onExpire: () => void;
  /** Seconds remaining at which the timer turns red (default 120). */
  warnSeconds?: number;
  className?: string;
}

/**
 * Countdown timer driven by an absolute end time, so it survives refreshes and
 * stays in sync with the server. Turns red inside the final `warnSeconds` and
 * calls `onExpire` once when it hits zero.
 */
export function Timer({
  endsAt,
  onExpire,
  warnSeconds = 120,
  className,
}: TimerProps) {
  const endMs = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((endMs - Date.now()) / 1000)),
  );
  const firedRef = useRef(false);

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const tick = useCallback(() => {
    const next = Math.max(0, Math.round((endMs - Date.now()) / 1000));
    setRemaining(next);
    if (next <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpireRef.current();
    }
  }, [endMs]);

  useEffect(() => {
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  const warning = remaining <= warnSeconds;

  return (
    <div
      role="timer"
      aria-live="off"
      // The value is derived from the wall clock, so server and client first
      // paints legitimately differ — don't treat that as a hydration error.
      suppressHydrationWarning
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums transition-colors",
        warning
          ? "animate-pulse bg-red-100 text-red-700"
          : "bg-muted text-foreground",
        className,
      )}
    >
      <Clock className="size-4" />
      {formatClock(remaining)}
    </div>
  );
}
