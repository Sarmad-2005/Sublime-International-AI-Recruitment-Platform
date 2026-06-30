"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiResponse, AssessmentResultDTO, AssessmentTakeDTO, TabSwitchResult } from "@/types";

import { FullscreenGuard } from "./FullscreenGuard";
import { ProgressBar } from "./ProgressBar";
import { QuestionCard } from "./QuestionCard";
import { Timer } from "./Timer";

type Answers = Record<string, string[]>;

interface AssessmentRunnerProps {
  applicationId: string;
  take: AssessmentTakeDTO;
}

/**
 * The controlled assessment interface (SRS M4). Owns the live attempt state:
 * full-screen enforcement, tab-switch detection (auto-submit + flag after the
 * limit), the countdown (auto-submit at zero), question navigation and the
 * confirm-submit flow. On submit it `router.replace`s to the result screen so
 * the browser back button can't return here.
 */
export function AssessmentRunner({ applicationId, take }: AssessmentRunnerProps) {
  const router = useRouter();
  const { questions, config } = take;

  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(take.tabSwitchCount);

  // Refs so the timer / visibility handlers always read the latest state
  // without re-subscribing (and so submit can't fire twice).
  const answersRef = useRef<Answers>(answers);
  answersRef.current = answers;
  const submittedRef = useRef(false);

  const total = questions.length;
  const current = questions[index];

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length,
    [questions, answers],
  );
  const unanswered = total - answeredCount;

  // ---- Submission -------------------------------------------------------
  const submit = useCallback(
    async (flaggedSuspicious: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);

      try {
        const res = await fetch(`/api/assessment/${applicationId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: answersRef.current, flaggedSuspicious }),
        });
        const json = (await res.json()) as ApiResponse<AssessmentResultDTO>;

        // Already-submitted races still belong on the result screen.
        if (!json.success && json.error.code !== "ALREADY_SUBMITTED") {
          throw new Error(json.error.message);
        }

        if (typeof document !== "undefined" && document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }
        router.replace(`/assessment/${applicationId}/result`);
      } catch (error) {
        submittedRef.current = false;
        setSubmitting(false);
        toast.error(
          error instanceof Error ? error.message : "Failed to submit. Please try again.",
        );
      }
    },
    [applicationId, router],
  );

  // ---- Tab-switch detection (anti-cheating) -----------------------------
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== "hidden" || submittedRef.current) return;

      void (async () => {
        try {
          const res = await fetch(`/api/assessment/${applicationId}/tab-switch`, {
            method: "POST",
          });
          const json = (await res.json()) as ApiResponse<TabSwitchResult>;
          if (json.success) {
            setTabSwitches(json.data.count);
            if (json.data.autoSubmit) {
              toast.error("Too many tab switches — your assessment was submitted.");
              void submit(true);
            }
          }
        } catch {
          // Network blips here must not break the assessment.
        }
      })();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [applicationId, submit]);

  // ---- Warn on accidental navigation away --------------------------------
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (submittedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  // ---- Answering & navigation -------------------------------------------
  function selectAnswer(optionIds: string[]) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: optionIds }));

    // Auto-advance after a single-answer pick, if configured.
    if (
      config.autoAdvance &&
      current.type !== "MULTI_SELECT" &&
      optionIds.length > 0 &&
      index < total - 1
    ) {
      window.setTimeout(() => setIndex((i) => Math.min(i + 1, total - 1)), 250);
    }
  }

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));
  const isLast = index === total - 1;

  const onExpire = useCallback(() => {
    toast.warning("Time's up — submitting your assessment.");
    void submit(false);
  }, [submit]);

  if (!current) return null;

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col">
      <FullscreenGuard active={!submitting && !submittedRef.current} />

      {/* Top bar */}
      <header className="border-b px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Question {index + 1}{" "}
                <span className="text-muted-foreground font-normal">of {total}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">{config.title}</p>
            </div>
            <Timer endsAt={take.endsAt} onExpire={onExpire} />
          </div>
          <ProgressBar answered={answeredCount} total={total} current={index + 1} />
        </div>
      </header>

      {/* Question body */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <QuestionCard
            question={current}
            index={index + 1}
            selected={answers[current.id] ?? []}
            onChange={selectAnswer}
          />
        </div>
      </main>

      {/* Navigation */}
      <footer className="border-t px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          {config.allowPrevious ? (
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={index === 0 || submitting}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
          ) : (
            <span />
          )}

          <span className="text-muted-foreground hidden text-xs sm:inline">
            {answeredCount}/{total} answered
          </span>

          {isLast ? (
            <Button
              variant="brand"
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Submit
            </Button>
          ) : (
            <Button variant="brand" onClick={goNext} disabled={submitting}>
              Next
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </footer>

      {/* Confirm-submit modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={!submitting}>
          <DialogHeader>
            <DialogTitle>Submit your assessment?</DialogTitle>
            <DialogDescription>
              {unanswered > 0
                ? `You have ${unanswered} ${unanswered === 1 ? "question" : "questions"} unanswered. You can't change your answers after submitting.`
                : "You've answered every question. You can't change your answers after submitting."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Keep working
            </Button>
            <Button variant="brand" onClick={() => void submit(false)} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Submitting…" : "Submit now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {tabSwitches > 0 && (
        <p className="sr-only" aria-live="polite">
          {tabSwitches} tab switch{tabSwitches === 1 ? "" : "es"} recorded.
        </p>
      )}
    </div>
  );
}
