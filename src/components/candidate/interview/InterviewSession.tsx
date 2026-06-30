"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Video,
} from "lucide-react";

import {
  AI_INTERVIEW_MIN_RESPONSE_SECONDS,
  AI_INTERVIEW_CHUNK_INTERVAL_MS,
  AI_INTERVIEW_QUESTION_TYPE_LABELS,
  CANDIDATE_TIER_LABELS,
  CANDIDATE_TIER_BADGES,
  type CandidateTier,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ApiResponse,
  InterviewQuestionDTO,
  InterviewScoreResult,
  InterviewSessionDTO,
} from "@/types";

import { AudioMeter } from "./AudioMeter";

// --- Minimal Web Speech typings (not in the standard DOM lib) ---------------
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface TranscriptDraft {
  order: number;
  questionId: string;
  questionText: string;
  questionType: string;
  answerText: string;
  durationSeconds: number;
  followUpQuestion: string | null;
  followUpAnswerText: string | null;
}

interface HistoryItem {
  question: string;
  answer: string;
  isFollowUp: boolean;
}

type Phase = "loading" | "running" | "submitting" | "complete" | "error";

interface InterviewSessionProps {
  session: InterviewSessionDTO;
}

/**
 * The live AI interview (SRS M5). Records the whole session (one continuous
 * WebM, streamed to storage in 30s chunks), reads each question aloud (Web
 * Speech TTS), transcribes the spoken answer in-browser (Web Speech STT), runs a
 * per-question countdown with a "Next" gate, optionally asks a Gemini follow-up,
 * then finalizes the recording and submits the transcript for scoring.
 *
 * The flow is driven imperatively by `runInterview()` (async/await over the
 * speak → answer-window → follow-up cycle) rather than nested effects, which
 * keeps the timing logic linear and cancellable.
 */
export function InterviewSession({ session }: InterviewSessionProps) {
  const { token, questions } = session;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const mountedRef = useRef(true);
  const chunkIndexRef = useRef(0);
  const uploadsRef = useRef<Promise<unknown>[]>([]);
  const answerRef = useRef("");
  const sttActiveRef = useRef(false);
  const nextResolverRef = useRef<(() => void) | null>(null);
  const transcriptRef = useRef<TranscriptDraft[]>([]);

  const [phase, setPhase] = useState<Phase>("loading");
  const [speaking, setSpeaking] = useState(false);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [current, setCurrent] = useState<InterviewQuestionDTO | null>(null);
  const [prompt, setPrompt] = useState(session.intro);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [canNext, setCanNext] = useState(false);
  const [liveAnswer, setLiveAnswer] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [result, setResult] = useState<InterviewScoreResult | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // ---- Web Speech: synthesis (questions) --------------------------------
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      setSpeaking(true);
      const done = () => {
        if (mountedRef.current) setSpeaking(false);
        resolve();
      };
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) {
        // No TTS — pace by estimated reading time so the UI doesn't jump ahead.
        window.setTimeout(done, Math.min(9_000, 1_200 + text.length * 45));
        return;
      }
      synth.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1;
      utt.lang = "en-US";
      utt.onend = done;
      utt.onerror = done;
      synth.speak(utt);
    });
  }, []);

  // ---- Web Speech: recognition (answers) --------------------------------
  const startSTT = useCallback(() => {
    answerRef.current = "";
    setLiveAnswer("");
    sttActiveRef.current = true;
    try {
      recognitionRef.current?.start();
    } catch {
      // start() throws if already started — safe to ignore.
    }
  }, []);

  const stopSTT = useCallback(() => {
    sttActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  // ---- Answer window: resolves on Next (after min time) or timeout -------
  const answerWindow = useCallback(
    (seconds: number): Promise<{ text: string; duration: number }> => {
      return new Promise((resolve) => {
        const startedAt = Date.now();
        let remaining = seconds;
        setSecondsLeft(seconds);
        setCanNext(seconds <= AI_INTERVIEW_MIN_RESPONSE_SECONDS);
        setAwaitingAnswer(true);

        const finish = () => {
          window.clearInterval(interval);
          nextResolverRef.current = null;
          setAwaitingAnswer(false);
          resolve({
            text: answerRef.current.trim(),
            duration: Math.round((Date.now() - startedAt) / 1000),
          });
        };
        nextResolverRef.current = finish;

        const interval = window.setInterval(() => {
          remaining -= 1;
          if (mountedRef.current) setSecondsLeft(Math.max(0, remaining));
          if (seconds - remaining >= AI_INTERVIEW_MIN_RESPONSE_SECONDS) {
            if (mountedRef.current) setCanNext(true);
          }
          if (remaining <= 0) finish();
        }, 1_000);
      });
    },
    [],
  );

  const handleNext = useCallback(() => {
    nextResolverRef.current?.();
  }, []);

  // ---- Recording: chunk upload + stop -----------------------------------
  const uploadChunk = useCallback(
    (blob: Blob) => {
      if (blob.size === 0) return;
      const idx = chunkIndexRef.current++;
      const p = fetch(
        `/api/interview/${token}/recording/chunk?chunkIndex=${idx}`,
        {
          method: "POST",
          headers: { "Content-Type": blob.type || "video/webm" },
          body: blob,
        },
      ).catch(() => {
        // A dropped chunk must not abort the interview.
      });
      uploadsRef.current.push(p);
    },
    [token],
  );

  const stopRecording = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve();
        return;
      }
      rec.onstop = async () => {
        await Promise.allSettled(uploadsRef.current);
        resolve();
      };
      try {
        rec.stop();
      } catch {
        resolve();
      }
    });
  }, []);

  // ---- Follow-up (Gemini) -----------------------------------------------
  const fetchFollowUp = useCallback(
    async (q: InterviewQuestionDTO, answer: string): Promise<string | null> => {
      if (!answer.trim()) return null; // nothing to probe
      try {
        const res = await fetch(`/api/interview/${token}/follow-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: q.id,
            question: q.questionText,
            response: answer,
          }),
        });
        const json = (await res.json()) as ApiResponse<{ followUp: string | null }>;
        return json.success ? json.data.followUp : null;
      } catch {
        return null;
      }
    },
    [token],
  );

  // ---- Submit (score only) ----------------------------------------------
  // Scoring needs just the transcript and is fast; the server stitches the
  // recording + sends notifications AFTER responding (via `after()`), so the
  // candidate isn't kept waiting on the slow download→concat→re-upload.
  const submit = useCallback(async () => {
    setPhase("submitting");
    try {
      const res = await fetch(`/api/interview/${token}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptRef.current,
          recordingUrl: null,
          durationSeconds: transcriptRef.current.reduce(
            (sum, t) => sum + t.durationSeconds,
            0,
          ),
        }),
      });
      const json = (await res.json()) as ApiResponse<InterviewScoreResult>;
      if (!json.success) throw new Error(json.error.message);
      if (!mountedRef.current) return;
      setResult(json.data);
      setPhase("complete");
    } catch (error) {
      if (!mountedRef.current) return;
      setFatalError(
        error instanceof Error ? error.message : "Failed to submit your interview.",
      );
      setPhase("error");
    }
  }, [token]);

  // ---- Orchestrator -----------------------------------------------------
  const runInterview = useCallback(async () => {
    setPhase("running");
    await speak(session.intro);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      if (!mountedRef.current) return;

      setIsFollowUp(false);
      setCurrent(q);
      setPrompt(q.questionText);
      await speak(q.questionText);
      if (!mountedRef.current) return;

      startSTT();
      const answer = await answerWindow(q.maxTimeSeconds);
      stopSTT();
      setHistory((h) => [
        ...h,
        { question: q.questionText, answer: answer.text, isFollowUp: false },
      ]);

      let followUpQuestion: string | null = null;
      let followUpAnswerText: string | null = null;

      const followUp = await fetchFollowUp(q, answer.text);
      if (followUp && mountedRef.current) {
        followUpQuestion = followUp;
        setIsFollowUp(true);
        setPrompt(followUp);
        await speak(followUp);
        if (mountedRef.current) {
          startSTT();
          const fuWindow = Math.min(45, q.maxTimeSeconds);
          const fuAnswer = await answerWindow(fuWindow);
          stopSTT();
          followUpAnswerText = fuAnswer.text;
          setHistory((h) => [
            ...h,
            { question: followUp, answer: fuAnswer.text, isFollowUp: true },
          ]);
        }
      }

      transcriptRef.current.push({
        order: i,
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        answerText: answer.text,
        durationSeconds: answer.duration,
        followUpQuestion,
        followUpAnswerText,
      });
    }

    if (!mountedRef.current) return;
    setCurrent(null);
    setPhase("submitting");
    setPrompt("Thank you — that's the end of the interview. Evaluating your responses…");
    await stopRecording();
    await submit();
  }, [
    answerWindow,
    fetchFollowUp,
    questions,
    session.intro,
    speak,
    startSTT,
    stopRecording,
    stopSTT,
    submit,
  ]);

  // ---- Setup: media + recorder + recognition, then run ------------------
  useEffect(() => {
    // Reset per-run state so a StrictMode remount starts from a clean slate
    // (the previous run's cleanup tore the media down).
    mountedRef.current = true;
    chunkIndexRef.current = 0;
    uploadsRef.current = [];
    transcriptRef.current = [];
    answerRef.current = "";

    let cancelled = false;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
        });
      } catch {
        setFatalError("Camera/microphone access is required for the interview.");
        setPhase("error");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setMicStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Speech recognition (optional — answers stay empty if unsupported).
      const Ctor =
        (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
          .webkitSpeechRecognition;
      if (Ctor) {
        const rec = new Ctor();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]!;
            if (r.isFinal) answerRef.current += r[0].transcript + " ";
            else interim += r[0].transcript;
          }
          if (mountedRef.current) setLiveAnswer((answerRef.current + interim).trim());
        };
        rec.onend = () => {
          // Browsers stop recognition periodically — restart while answering.
          if (sttActiveRef.current) {
            try {
              rec.start();
            } catch {
              // ignore
            }
          }
        };
        rec.onerror = () => {};
        recognitionRef.current = rec;
      }

      // MediaRecorder — one continuous recording, chunked every 30s.
      const mimeType = pickMimeType();
      try {
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );
        recorder.ondataavailable = (e) => uploadChunk(e.data);
        recorder.start(AI_INTERVIEW_CHUNK_INTERVAL_MS);
        recorderRef.current = recorder;
      } catch {
        // Recording unsupported — proceed without it (transcript still scores).
      }

      await runInterview();
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      sttActiveRef.current = false;
      nextResolverRef.current = null;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [runInterview, uploadChunk]);

  // ---- Warn before leaving while in progress ----------------------------
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (phase === "complete" || phase === "error") return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [phase]);

  // ---- Render -----------------------------------------------------------
  if (phase === "complete" && result) {
    return <InterviewComplete result={result} jobTitle={session.jobTitle} />;
  }

  if (phase === "error") {
    return (
      <div className="bg-muted/30 flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <AlertTriangle className="mx-auto size-10 text-amber-500" />
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            {fatalError ?? "The interview couldn't be completed."}
          </p>
          {transcriptRef.current.length > 0 && (
            <Button variant="brand" onClick={() => void submit()}>
              Retry submission
            </Button>
          )}
          <p className="text-muted-foreground text-xs">
            If this keeps happening, contact Sublime International.
          </p>
        </div>
      </div>
    );
  }

  const questionNumber = current
    ? questions.findIndex((q) => q.id === current.id) + 1
    : questions.length;

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-5">
        {/* Left (60%) — interviewer + transcript */}
        <section className="flex flex-col gap-4 lg:col-span-3">
          <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
            <div
              className={cn(
                "bg-royal/10 text-royal flex size-12 shrink-0 items-center justify-center rounded-full",
                speaking && "ring-royal/40 animate-pulse ring-4",
              )}
            >
              <Bot className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">AI Interviewer</p>
              <p className="text-muted-foreground text-xs">
                {speaking
                  ? "Speaking…"
                  : awaitingAnswer
                    ? "Listening to your answer"
                    : phase === "submitting"
                      ? "Processing…"
                      : "Preparing…"}
              </p>
            </div>
          </div>

          <div className="bg-card flex-1 rounded-xl border p-5">
            {isFollowUp && (
              <span className="bg-amber-100 text-amber-700 mb-2 inline-block rounded px-2 py-0.5 text-xs font-medium">
                Follow-up
              </span>
            )}
            <p className="text-lg leading-relaxed font-medium">{prompt}</p>

            {history.length > 0 && (
              <div className="mt-6 space-y-3 border-t pt-4">
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  Transcript
                </p>
                <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
                  {history.map((h, i) => (
                    <div key={i} className="text-sm">
                      <p className="text-muted-foreground">
                        {h.isFollowUp ? "↳ " : ""}
                        {h.question}
                      </p>
                      <p className="mt-0.5">
                        {h.answer || (
                          <span className="text-muted-foreground italic">
                            (no answer transcribed)
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right (40%) — candidate camera + timer */}
        <section className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-medium">
              Question {questionNumber} of {questions.length}
            </span>
            {current && (
              <span className="bg-muted rounded px-2 py-0.5 text-xs font-medium">
                {AI_INTERVIEW_QUESTION_TYPE_LABELS[current.questionType] ??
                  current.questionType}
              </span>
            )}
          </div>

          <div className="bg-foreground/90 relative aspect-video overflow-hidden rounded-xl">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-full w-full scale-x-[-1] object-cover"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-red-600/90 px-2 py-0.5 text-xs font-medium text-white">
              <span className="size-2 animate-pulse rounded-full bg-white" /> REC
            </div>
            {awaitingAnswer && (
              <div className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 font-mono text-lg font-bold text-white tabular-nums">
                {String(Math.floor(secondsLeft / 60)).padStart(1, "0")}:
                {String(secondsLeft % 60).padStart(2, "0")}
              </div>
            )}
          </div>

          {awaitingAnswer && (
            <div className="bg-card rounded-xl border p-3">
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                Your answer (live transcript)
              </p>
              <p className="min-h-[3rem] text-sm">
                {liveAnswer || (
                  <span className="text-muted-foreground italic">
                    Start speaking…
                  </span>
                )}
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Bottom bar — audio meter + Next */}
      <footer className="bg-card border-t px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div className="w-40 shrink-0">
            <AudioMeter stream={micStream} />
          </div>
          <div className="flex-1" />
          {phase === "submitting" ? (
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Evaluating your interview…
            </span>
          ) : (
            <Button
              variant="brand"
              onClick={handleNext}
              disabled={!awaitingAnswer || !canNext}
            >
              {questionNumber >= questions.length && !isFollowUp ? "Finish" : "Next Question"}
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

/** Pick a supported WebM mime type, preferring VP8/Opus. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

// ---------------------------------------------------------------------------
// Completion screen
// ---------------------------------------------------------------------------

function InterviewComplete({
  result,
  jobTitle,
}: {
  result: InterviewScoreResult;
  jobTitle: string;
}) {
  const { scores, tier } = result;
  const tierKey = tier.tier as CandidateTier;
  const bars: Array<{ label: string; value: number }> = [
    { label: "Technical", value: scores.technicalScore },
    { label: "Communication", value: scores.communicationScore },
    { label: "Behavioral", value: scores.behavioralScore },
    { label: "Confidence", value: scores.confidenceScore },
  ];

  return (
    <div className="bg-muted/30 min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
          <h1 className="mt-3 text-2xl font-bold">Interview complete</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Thanks for completing the AI interview for {jobTitle}. You&apos;ve been
            shortlisted for employer review.
          </p>
        </div>

        <div className="bg-card rounded-xl border p-6 text-center">
          <p className="text-muted-foreground text-xs font-semibold uppercase">
            Your tier
          </p>
          <p className="mt-1 text-3xl font-bold">
            <span aria-hidden className="mr-2">
              {CANDIDATE_TIER_BADGES[tierKey]}
            </span>
            {CANDIDATE_TIER_LABELS[tierKey]}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Overall interview score {scores.overallInterviewScore}/100 · Final score{" "}
            {Math.round(tier.finalScore)}/100
          </p>
        </div>

        <div className="bg-card space-y-4 rounded-xl border p-6">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{b.label}</span>
                <span className="font-medium">{b.value}/100</span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="bg-royal h-full rounded-full"
                  style={{ width: `${b.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {scores.aiSummary && (
          <div className="bg-card rounded-xl border p-6">
            <p className="text-muted-foreground text-xs font-semibold uppercase">
              Summary
            </p>
            <p className="mt-2 text-sm leading-relaxed">{scores.aiSummary}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {scores.strengths.length > 0 && (
            <div className="bg-card rounded-xl border p-5">
              <p className="mb-2 text-sm font-semibold text-emerald-700">Strengths</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                {scores.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {scores.improvements.length > 0 && (
            <div className="bg-card rounded-xl border p-5">
              <p className="mb-2 text-sm font-semibold text-amber-700">
                Areas to develop
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                {scores.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-muted-foreground flex items-center justify-center gap-1 text-center text-xs">
          <Video className="size-3.5" /> Your recording has been securely saved.
        </p>
      </div>
    </div>
  );
}
