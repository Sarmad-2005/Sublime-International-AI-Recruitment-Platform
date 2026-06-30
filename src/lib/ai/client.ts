import "server-only";

import { GoogleGenAI } from "@google/genai";

import { serverEnv } from "@/lib/env";

/**
 * Google Gemini client for the AI interviewer + scoring pipeline (SRS M5).
 *
 * Server-only — the API key never reaches the browser. Provider-neutral surface:
 * the rest of the app calls {@link runAi}, so swapping the model/provider later
 * only touches this file.
 *
 * Reliability requirements (from the M5 spec):
 *  - 30s timeout per request (`httpOptions.timeout`, ms).
 *  - up to 2 retries with exponential backoff on transient failures (429/5xx/
 *    network/timeout) — hand-rolled here since the Gemini SDK doesn't retry.
 * Every call returns a structured debug entry (model, finish reason, usage, raw
 * text) for troubleshooting — persisted onto the attempt by the interview
 * service. Scoring uses Gemini's JSON mode (`responseMimeType`) for reliable,
 * parseable output.
 */

/**
 * Model that plays the interviewer and the evaluator. `gemini-2.5-flash` is the
 * Flash model served on the Google AI Studio free tier (2.0-flash returns a
 * free-tier quota of 0). It's a *thinking* model, so we disable thinking
 * ({@link THINKING_BUDGET} = 0) below — otherwise internal "thinking" consumes
 * `maxOutputTokens` and can leave the visible answer empty.
 */
export const INTERVIEW_MODEL = "gemini-2.5-flash";

/** 0 disables Gemini 2.5 thinking → `maxOutputTokens` maps to visible output. */
const THINKING_BUDGET = 0;

/** Per-request timeout (ms). */
export const AI_TIMEOUT_MS = 30_000;

/** Max retries on transient failures (exponential backoff). */
export const AI_MAX_RETRIES = 2;

const ai = new GoogleGenAI({
  apiKey: serverEnv.GEMINI_API_KEY,
  httpOptions: { timeout: AI_TIMEOUT_MS },
});

/** One troubleshooting record per model call (stored in the attempt's JSON). */
export interface AiDebugEntry {
  /** ISO timestamp. */
  at: string;
  /** Logical call site, e.g. "follow_up" | "scoring". */
  kind: string;
  model: string;
  finishReason: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  /** Raw model text (truncated to keep the JSON column small). */
  raw: string;
  /** Present only when the call threw or the model was blocked. */
  error?: string;
}

const MAX_RAW_DEBUG_CHARS = 8_000;

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: string,
    readonly debug: AiDebugEntry,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiTextRequest {
  /** Call site label for the debug log. */
  kind: string;
  /** System instruction (persona / output rules). */
  system?: string;
  /** The user prompt. */
  prompt: string;
  /** Output token ceiling. */
  maxTokens: number;
  /** Request strict JSON output (Gemini JSON mode). */
  json?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 408 / 429 / 5xx / network / timeout are worth retrying; 4xx aren't. */
function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number } | null | undefined)?.status;
  if (typeof status === "number") {
    return status === 408 || status === 429 || status >= 500;
  }
  return true; // no status → network/timeout/unknown
}

/**
 * Run a Gemini generation and return the text plus a debug entry. Blocked
 * responses and transport failures (after retries) become an {@link AiError}
 * that still carries its debug record, so the caller can persist the trace.
 */
export async function runAi(
  req: AiTextRequest,
): Promise<{ text: string; debug: AiDebugEntry }> {
  const at = new Date().toISOString();
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: INTERVIEW_MODEL,
          contents: req.prompt,
          config: {
            ...(req.system ? { systemInstruction: req.system } : {}),
            maxOutputTokens: req.maxTokens,
            thinkingConfig: { thinkingBudget: THINKING_BUDGET },
            ...(req.json ? { responseMimeType: "application/json" } : {}),
          },
        });

        const text = (response.text ?? "").trim();
        const usage = response.usageMetadata;
        const finishReason = response.candidates?.[0]?.finishReason;
        const debug: AiDebugEntry = {
          at,
          kind: req.kind,
          model: INTERVIEW_MODEL,
          finishReason: finishReason ? String(finishReason) : null,
          usage: usage
            ? {
                inputTokens: usage.promptTokenCount ?? 0,
                outputTokens: usage.candidatesTokenCount ?? 0,
              }
            : null,
          raw: text.slice(0, MAX_RAW_DEBUG_CHARS),
        };

        const blockReason = response.promptFeedback?.blockReason;
        if (!text && (blockReason || String(finishReason) === "SAFETY")) {
          debug.error = `Blocked: ${blockReason ?? finishReason}`;
          throw new AiError("The model declined to respond.", req.kind, debug);
        }

        return { text, debug };
      } catch (error) {
        lastError = error;
        if (error instanceof AiError) throw error;
        if (attempt === AI_MAX_RETRIES || !isRetryable(error)) throw error;
        await sleep(500 * 2 ** attempt + Math.floor(Math.random() * 250));
      }
    }
    throw lastError;
  } catch (error) {
    if (error instanceof AiError) throw error;
    const debug: AiDebugEntry = {
      at,
      kind: req.kind,
      model: INTERVIEW_MODEL,
      finishReason: null,
      usage: null,
      raw: "",
      error: error instanceof Error ? error.message : String(error),
    };
    throw new AiError(`AI ${req.kind} request failed: ${debug.error}`, req.kind, debug);
  }
}
