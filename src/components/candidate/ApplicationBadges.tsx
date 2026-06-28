import {
  APPLICATION_STATUS_LABELS,
  CANDIDATE_TIER_LABELS,
  CANDIDATE_TIER_BADGES,
  type CandidateTier,
} from "@/lib/constants";
import { statusVariant } from "@/lib/utils/applications";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/generated/prisma/enums";

/** Coloured badge for an application's pipeline status. */
export function ApplicationStatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  return (
    <Badge variant={statusVariant(status)} className={className}>
      {APPLICATION_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** Tier-coloured pill (Diamond / Platinum / Gold / Bronze). */
const TIER_CLASSES: Record<CandidateTier, string> = {
  DIAMOND: "bg-sky-100 text-sky-700 border-sky-200",
  PLATINUM: "bg-slate-100 text-slate-700 border-slate-200",
  GOLD: "bg-amber-100 text-amber-700 border-amber-200",
  BRONZE: "bg-orange-100 text-orange-700 border-orange-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  PENDING: "bg-muted text-muted-foreground",
};

export function TierBadge({
  tier,
  className,
}: {
  tier: CandidateTier;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1", TIER_CLASSES[tier], className)}
    >
      <span aria-hidden>{CANDIDATE_TIER_BADGES[tier]}</span>
      {CANDIDATE_TIER_LABELS[tier]}
    </Badge>
  );
}
