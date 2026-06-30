"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Request full-screen on the document element (best-effort). Resolves whether
 * the request was accepted; fails quietly on mobile / unsupported browsers.
 */
export async function requestAssessmentFullscreen(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const el = document.documentElement;
  if (!el.requestFullscreen) return false;
  try {
    await el.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

interface FullscreenGuardProps {
  /** While true, exiting full-screen surfaces the warning overlay. */
  active: boolean;
  /** Fired each time the candidate leaves full-screen while active. */
  onExit?: () => void;
}

/**
 * Enforces full-screen during a desktop assessment. On mount it attempts to
 * enter full-screen; whenever the candidate leaves it (Esc, F11, …) a blocking
 * overlay prompts them to return. The Fullscreen API needs a user gesture, so
 * re-entry happens via the overlay button.
 *
 * Browsers without the Fullscreen API (most mobile) are treated as exempt — the
 * guard renders nothing and never blocks.
 */
export function FullscreenGuard({ active, onExit }: FullscreenGuardProps) {
  const [supported, setSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // True once we've confirmed the environment refuses full-screen (e.g. an
  // embedded/preview browser). We then degrade gracefully instead of trapping
  // the candidate behind an overlay they can never dismiss.
  const [blocked, setBlocked] = useState(false);

  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useEffect(() => {
    const canFullscreen =
      typeof document !== "undefined" &&
      typeof document.documentElement.requestFullscreen === "function";
    setSupported(canFullscreen);
    if (!canFullscreen) return;

    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Try to enter full-screen as soon as the assessment becomes active. This
  // succeeds when a recent user gesture (the Start button) is still in scope.
  useEffect(() => {
    if (active && supported && !document.fullscreenElement) {
      void requestAssessmentFullscreen();
    }
  }, [active, supported]);

  // Notify the parent each time full-screen is lost mid-assessment.
  useEffect(() => {
    if (active && supported && !blocked && !isFullscreen) {
      onExitRef.current?.();
    }
  }, [active, supported, blocked, isFullscreen]);

  // Re-enter on the candidate's gesture. If even an explicit click can't enter
  // full-screen, the environment forbids it — stop enforcing so they aren't
  // stuck behind this overlay.
  async function handleReturn() {
    const ok = await requestAssessmentFullscreen();
    if (!ok) setBlocked(true);
  }

  if (!active || !supported || blocked || isFullscreen) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-background w-full max-w-md space-y-4 rounded-xl border p-6 text-center shadow-xl">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-amber-100 text-amber-600">
          <ShieldAlert className="size-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">Full screen required</h2>
          <p className="text-muted-foreground text-sm">
            You left full-screen mode. This is recorded. Return to full screen to
            continue your assessment — your timer is still running.
          </p>
        </div>
        <Button variant="brand" className="w-full" onClick={() => void handleReturn()}>
          <Maximize className="size-4" />
          Return to full screen
        </Button>
      </div>
    </div>
  );
}
