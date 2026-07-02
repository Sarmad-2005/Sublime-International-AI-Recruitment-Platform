import { cn } from "@/lib/utils";
import {
  CANDIDATE_TIER_BADGES,
  CANDIDATE_TIER_LABELS,
  type CandidateTier,
} from "@/lib/constants";

/** Tailwind classes per tier — corporate, muted palette. */
const TIER_STYLES: Record<CandidateTier, string> = {
  DIAMOND: "bg-sky-50 text-sky-700 ring-sky-200",
  PLATINUM: "bg-violet-50 text-violet-700 ring-violet-200",
  GOLD: "bg-amber-50 text-amber-700 ring-amber-200",
  BRONZE: "bg-orange-50 text-orange-700 ring-orange-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
  PENDING: "bg-muted text-muted-foreground ring-border",
};

interface TierBadgeProps {
  tier: CandidateTier;
  className?: string;
  /** Larger variant for the profile hero. */
  size?: "sm" | "md" | "lg";
}

/** A tier pill (emoji + label) with a tier-specific colour. */
export function TierBadge({ tier, className, size = "sm" }: TierBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset",
        size === "sm" && "px-2.5 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base",
        TIER_STYLES[tier],
        className,
      )}
    >
      <span aria-hidden>{CANDIDATE_TIER_BADGES[tier]}</span>
      {CANDIDATE_TIER_LABELS[tier]}
    </span>
  );
}
