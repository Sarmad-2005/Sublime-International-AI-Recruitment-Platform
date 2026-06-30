"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ApiResponse, StartAttemptResult } from "@/types";

import { requestAssessmentFullscreen } from "./FullscreenGuard";

interface StartAssessmentButtonProps {
  applicationId: string;
  /** "Start Assessment" on a first attempt, "Retake Assessment" otherwise. */
  label?: string;
}

/**
 * Starts (or resumes/retakes) an attempt then navigates into the controlled
 * interface. Full-screen is requested *here*, inside the click handler, so the
 * user gesture carries into the take page (App-Router client nav keeps the
 * document). Uses `router.replace` so back doesn't return to the instructions.
 */
export function StartAssessmentButton({
  applicationId,
  label = "Start Assessment",
}: StartAssessmentButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (loading) return;
    setLoading(true);

    // Best-effort full-screen within the gesture (no-op on mobile).
    await requestAssessmentFullscreen();

    try {
      const res = await fetch(`/api/assessment/${applicationId}/start`, {
        method: "POST",
      });
      const json = (await res.json()) as ApiResponse<StartAttemptResult>;
      if (!json.success) throw new Error(json.error.message);
      router.replace(`/assessment/${applicationId}/take`);
    } catch (error) {
      setLoading(false);
      toast.error(
        error instanceof Error ? error.message : "Couldn't start the assessment.",
      );
    }
  }

  return (
    <Button variant="brand" size="lg" onClick={handleStart} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
      {loading ? "Starting…" : label}
    </Button>
  );
}
