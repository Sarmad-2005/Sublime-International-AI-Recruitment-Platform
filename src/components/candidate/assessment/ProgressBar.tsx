"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** How many questions have an answer recorded. */
  answered: number;
  /** Total number of questions. */
  total: number;
  /** 1-based index of the current question (drives the marker). */
  current: number;
  className?: string;
}

/**
 * Slim progress bar for the assessment top bar — fills to the share of
 * questions answered, with a subtle marker at the current position.
 */
export function ProgressBar({
  answered,
  total,
  current,
  className,
}: ProgressBarProps) {
  const safeTotal = Math.max(1, total);
  const answeredPct = Math.round((answered / safeTotal) * 100);
  const currentPct = Math.round((current / safeTotal) * 100);

  return (
    <div
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={answered}
      aria-label={`${answered} of ${total} questions answered`}
    >
      <div
        className="bg-royal h-full rounded-full transition-all duration-300"
        style={{ width: `${answeredPct}%` }}
      />
      <span
        className="bg-royal-dark absolute top-0 h-full w-0.5"
        style={{ left: `calc(${currentPct}% - 1px)` }}
        aria-hidden
      />
    </div>
  );
}
