"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mic,
  PlayCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AI_INTERVIEW_MIN_RESPONSE_SECONDS,
  AI_INTERVIEW_QUESTION_TYPE_LABELS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AudioMeter } from "@/components/candidate/interview/AudioMeter";
import type { AdminInterviewQuestion, InterviewSetDetail } from "@/types";

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

/**
 * Admin-facing preview of the candidate AI interview. Mirrors the real flow
 * (`InterviewSession`) — reads each question aloud (Web Speech TTS), records the
 * webcam + mic, runs a per-question countdown with a "Next" gate and shows a
 * live transcript — but is entirely local: nothing is uploaded, scored or saved.
 */
export function InterviewPreview({ set }: { set: InterviewSetDetail }) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setStarted(false); // unmounts the runner → tears media down
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <PlayCircle className="size-4" />
          Preview Interview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Interview Preview</DialogTitle>
          <DialogDescription>
            A live simulation of the candidate&apos;s AI interview — voice, camera
            and recording. Nothing is saved.
          </DialogDescription>
        </DialogHeader>

        {!started ? (
          <div className="space-y-4 py-4 text-center">
            <div className="bg-royal/10 text-royal mx-auto grid size-14 place-items-center rounded-full">
              <Mic className="size-7" />
            </div>
            <div>
              <p className="font-semibold">{set.title}</p>
              <p className="text-muted-foreground text-sm">
                {set.questions.length} question
                {set.questions.length === 1 ? "" : "s"} · {set.maxDurationMinutes}{" "}
                min max
              </p>
            </div>
            {set.questions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Add questions to preview the interview.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground mx-auto max-w-sm text-xs">
                  This uses your camera and microphone so you can experience the
                  candidate flow. The AI interviewer will speak each question
                  aloud.
                </p>
                <Button
                  type="button"
                  className="bg-royal hover:bg-royal/90 gap-1.5 text-white"
                  onClick={() => setStarted(true)}
                >
                  <PlayCircle className="size-4" />
                  Start Preview
                </Button>
              </>
            )}
          </div>
        ) : (
          <PreviewRunner set={set} onRestart={() => setStarted(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Runner — media + TTS/STT + countdown flow (local only)
// ---------------------------------------------------------------------------

type Phase = "starting" | "running" | "complete" | "error";

interface HistoryItem {
  question: string;
  answer: string;
}

function PreviewRunner({
  set,
  onRestart,
}: {
  set: InterviewSetDetail;
  onRestart: () => void;
}) {
  const questions = set.questions;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mountedRef = useRef(true);
  const answerRef = useRef("");
  const sttActiveRef = useRef(false);
  const nextResolverRef = useRef<(() => void) | null>(null);

  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [speaking, setSpeaking] = useState(false);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);
  const [current, setCurrent] = useState<AdminInterviewQuestion | null>(null);
  const [prompt, setPrompt] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [canNext, setCanNext] = useState(false);
  const [liveAnswer, setLiveAnswer] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ---- TTS ----------------------------------------------------------------
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      setSpeaking(true);
      const done = () => {
        if (mountedRef.current) setSpeaking(false);
        resolve();
      };
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) {
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

  // ---- STT ----------------------------------------------------------------
  const startSTT = useCallback(() => {
    answerRef.current = "";
    setLiveAnswer("");
    sttActiveRef.current = true;
    try {
      recognitionRef.current?.start();
    } catch {
      // start() throws if already running — safe to ignore.
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

  // ---- Answer window ------------------------------------------------------
  const answerWindow = useCallback((seconds: number): Promise<string> => {
    return new Promise((resolve) => {
      let remaining = seconds;
      setSecondsLeft(seconds);
      setCanNext(seconds <= AI_INTERVIEW_MIN_RESPONSE_SECONDS);
      setAwaitingAnswer(true);

      const finish = () => {
        window.clearInterval(interval);
        nextResolverRef.current = null;
        setAwaitingAnswer(false);
        resolve(answerRef.current.trim());
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
  }, []);

  const handleNext = useCallback(() => {
    nextResolverRef.current?.();
  }, []);

  // ---- Orchestrator -------------------------------------------------------
  const runInterview = useCallback(async () => {
    setPhase("running");
    await speak(
      "Welcome. This is a preview of the AI interview. I'll ask each question aloud — answer as the candidate would.",
    );

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      if (!mountedRef.current) return;

      setCurrent(q);
      setPrompt(q.questionText);
      await speak(q.questionText);
      if (!mountedRef.current) return;

      startSTT();
      const answer = await answerWindow(q.maxTimeSeconds);
      stopSTT();
      setHistory((h) => [...h, { question: q.questionText, answer }]);
    }

    if (!mountedRef.current) return;
    setCurrent(null);
    setPrompt("That's the end of the interview. Thank you.");
    setPhase("complete");
  }, [answerWindow, questions, speak, startSTT, stopSTT]);

  // ---- Setup: media + recorder + recognition, then run --------------------
  useEffect(() => {
    mountedRef.current = true;
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
        if (!cancelled) {
          setError("Camera/microphone access is required to preview the interview.");
          setPhase("error");
        }
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

      // Speech recognition (optional).
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

      // Real MediaRecorder so the REC indicator is genuine — data is discarded.
      try {
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = () => {
          // Preview only — discard captured chunks.
        };
        recorder.start(5_000);
        recorderRef.current = recorder;
      } catch {
        // Recording unsupported — the preview still runs.
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
  }, [runInterview]);

  // ---- Render -------------------------------------------------------------
  if (phase === "error") {
    return (
      <div className="space-y-4 py-6 text-center">
        <AlertTriangle className="mx-auto size-10 text-amber-500" />
        <p className="text-sm font-medium">Preview unavailable</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {error ?? "The preview couldn't start."}
        </p>
        <Button type="button" variant="outline" onClick={onRestart}>
          Back
        </Button>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-green-500" />
        <div>
          <p className="font-semibold">Preview complete</p>
          <p className="text-muted-foreground text-sm">
            In a real interview, the candidate&apos;s responses would now be scored
            by the AI.
          </p>
        </div>
        {history.length > 0 && (
          <div className="mx-auto max-w-md space-y-2 rounded-md border p-4 text-left">
            <p className="text-muted-foreground text-xs font-semibold uppercase">
              Your transcript
            </p>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="text-sm">
                  <p className="text-muted-foreground text-xs">{h.question}</p>
                  <p>
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
        <Button type="button" variant="outline" onClick={onRestart}>
          Restart Preview
        </Button>
      </div>
    );
  }

  const questionNumber = current
    ? questions.findIndex((q) => q.id === current.id) + 1
    : questions.length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-5">
        {/* Interviewer + prompt */}
        <div className="space-y-3 sm:col-span-3">
          <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
            <div
              className={cn(
                "bg-royal/10 text-royal flex size-10 shrink-0 items-center justify-center rounded-full",
                speaking && "ring-royal/40 animate-pulse ring-4",
              )}
            >
              <Bot className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">AI Interviewer</p>
              <p className="text-muted-foreground text-xs">
                {speaking
                  ? "Speaking…"
                  : awaitingAnswer
                    ? "Listening to your answer"
                    : "Preparing…"}
              </p>
            </div>
          </div>

          <div className="bg-card min-h-24 rounded-lg border p-4">
            <p className="leading-relaxed font-medium">{prompt}</p>
          </div>

          {awaitingAnswer && (
            <div className="bg-card rounded-lg border p-3">
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                Your answer (live transcript)
              </p>
              <p className="min-h-[2.5rem] text-sm">
                {liveAnswer || (
                  <span className="text-muted-foreground italic">Start speaking…</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Camera + timer */}
        <div className="space-y-3 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              {phase === "starting"
                ? "Starting…"
                : `Question ${questionNumber} of ${questions.length}`}
            </span>
            {current && (
              <Badge variant="outline" className="text-xs">
                {AI_INTERVIEW_QUESTION_TYPE_LABELS[current.questionType] ??
                  current.questionType}
              </Badge>
            )}
          </div>

          <div className="bg-foreground/90 relative aspect-video overflow-hidden rounded-lg">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-full w-full scale-x-[-1] object-cover"
            />
            {phase === "starting" && (
              <div className="absolute inset-0 grid place-items-center">
                <Loader2 className="size-6 animate-spin text-white" />
              </div>
            )}
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-red-600/90 px-2 py-0.5 text-xs font-medium text-white">
              <span className="size-2 animate-pulse rounded-full bg-white" /> REC
            </div>
            {awaitingAnswer && (
              <div className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 font-mono text-base font-bold text-white tabular-nums">
                {String(Math.floor(secondsLeft / 60))}:
                {String(secondsLeft % 60).padStart(2, "0")}
              </div>
            )}
          </div>

          <AudioMeter stream={micStream} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-muted-foreground text-xs">Preview · nothing is saved</span>
        <Button
          type="button"
          className="bg-royal hover:bg-royal/90 gap-1.5 text-white"
          onClick={handleNext}
          disabled={!awaitingAnswer || !canNext}
        >
          {questionNumber >= questions.length ? "Finish" : "Next Question"}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
