import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Star,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { CANDIDATE_STATUS_BUCKETS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import type { CandidateDashboardData } from "@/types";

const BUCKET_META: Record<
  (typeof CANDIDATE_STATUS_BUCKETS)[number],
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  APPLIED: { icon: ClipboardList, className: "text-sky-600 bg-sky-50" },
  ASSESSMENT_PENDING: { icon: FileCheck2, className: "text-amber-600 bg-amber-50" },
  INTERVIEW_PENDING: { icon: Video, className: "text-violet-600 bg-violet-50" },
  SHORTLISTED: { icon: Star, className: "text-blue-600 bg-blue-50" },
  SELECTED: { icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50" },
};

/** The five candidate pipeline stat cards (SRS §3.7.1). */
export function DashboardStatusCards({
  counts,
}: {
  counts: CandidateDashboardData["statusCounts"];
}) {
  const t = useTranslations("candidate.status");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CANDIDATE_STATUS_BUCKETS.map((bucket) => {
        const meta = BUCKET_META[bucket];
        const Icon = meta.icon;
        return (
          <Card key={bucket} className="gap-2 p-4">
            <div
              className={cn(
                "grid size-9 place-items-center rounded-lg",
                meta.className,
              )}
            >
              <Icon className="size-5" />
            </div>
            <p className="text-2xl font-bold tabular-nums">{counts[bucket]}</p>
            <p className="text-muted-foreground text-xs leading-tight">
              {t(bucket)}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
