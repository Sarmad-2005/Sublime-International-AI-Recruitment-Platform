import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_ORDER,
  type PipelineStage,
} from "@/lib/constants";
import type { ApplicationStatus } from "@/generated/prisma/enums";

function getStageIndex(status: ApplicationStatus): number {
  let stage: PipelineStage;
  switch (status) {
    case "ASSESSMENT_PENDING":
    case "ASSESSMENT_PASSED":
    case "ASSESSMENT_FAILED":
      stage = "ASSESSMENT";
      break;
    case "INTERVIEW_INVITED":
    case "INTERVIEW_IN_PROGRESS":
    case "INTERVIEW_COMPLETED":
      stage = "INTERVIEW";
      break;
    case "TIERED":
    case "IN_CLIENT_POOL":
    case "CLIENT_SHORTLISTED":
    case "LIVE_INTERVIEW_SCHEDULED":
      stage = "SHORTLISTED";
      break;
    case "SELECTED":
      stage = "SELECTED";
      break;
    case "POST_SELECTION":
    case "DEPLOYED":
      stage = "POST_SELECTION";
      break;
    default:
      stage = "APPLIED";
  }
  return PIPELINE_STAGE_ORDER.indexOf(stage);
}

export async function StageProgressBar({ status }: { status: ApplicationStatus }) {
  const t = await getTranslations("admin.candidates.stageBar");
  const currentIndex = getStageIndex(status);
  const isRejected = status === "REJECTED" || status === "WITHDRAWN";

  return (
    <div className="w-full overflow-x-auto">
      <ol className="flex min-w-max items-center gap-0">
        {PIPELINE_STAGE_ORDER.map((stage, i) => {
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex && !isRejected;
          const isLast = i === PIPELINE_STAGE_ORDER.length - 1;

          return (
            <li key={stage} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isPast && "border-royal bg-royal text-white",
                    isCurrent && "border-royal text-royal ring-royal/20 bg-white ring-4",
                    !isPast && !isCurrent && "border-border text-muted-foreground bg-white",
                    isRejected && "border-red-400 bg-red-50 text-red-500",
                  )}
                >
                  {isPast ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-center text-[10px] font-medium leading-tight",
                    isPast && "text-royal",
                    isCurrent && "text-royal font-semibold",
                    !isPast && !isCurrent && "text-muted-foreground",
                  )}
                >
                  {PIPELINE_STAGE_LABELS[stage]}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-1 h-px w-10 self-start mt-3.5",
                    isPast ? "bg-royal" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      {isRejected && (
        <p className="mt-2 text-xs font-medium text-red-500">
          {status === "WITHDRAWN" ? t("withdrawn") : t("rejected")}
        </p>
      )}
    </div>
  );
}
