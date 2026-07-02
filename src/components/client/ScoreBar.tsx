import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  /** 0–100 or null when the score isn't available. */
  value: number | null;
  className?: string;
  /** Accent colour of the fill. */
  color?: "royal" | "navy" | "gold" | "emerald";
}

const FILL_COLORS = {
  royal: "bg-royal",
  navy: "bg-navy",
  gold: "bg-gold",
  emerald: "bg-emerald-500",
} as const;

/** A labelled horizontal score bar with the numeric value on the right. */
export function ScoreBar({
  label,
  value,
  className,
  color = "royal",
}: ScoreBarProps) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-semibold tabular-nums">
          {value == null ? "—" : `${Math.round(value)}`}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", FILL_COLORS[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
