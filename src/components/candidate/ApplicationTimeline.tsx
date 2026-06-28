import { format } from "date-fns";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ApplicationTimelineItem } from "@/types";

/**
 * Vertical history timeline for an application. Completed steps are filled,
 * the current step is highlighted (royal ring), and upcoming steps are muted.
 */
export function ApplicationTimeline({
  items,
}: {
  items: ApplicationTimelineItem[];
}) {
  return (
    <ol className="relative space-y-6">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-4">
            {/* Connector line */}
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 left-3.5 h-[calc(100%+0.25rem)] w-px -translate-x-1/2",
                  item.state === "done" ? "bg-royal" : "bg-border",
                )}
              />
            )}

            {/* Node */}
            <span
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2",
                item.state === "done" &&
                  "border-royal bg-royal text-white",
                item.state === "current" &&
                  "border-royal text-royal ring-royal/20 bg-white ring-4",
                item.state === "upcoming" &&
                  "border-border text-muted-foreground bg-white",
              )}
            >
              {item.state === "done" ? (
                <Check className="size-4" />
              ) : (
                <span className="size-2 rounded-full bg-current" />
              )}
            </span>

            {/* Content */}
            <div className="-mt-0.5 flex-1 pb-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  item.state === "upcoming" && "text-muted-foreground",
                )}
              >
                {item.title}
              </p>
              {item.description && (
                <p className="text-muted-foreground text-xs">{item.description}</p>
              )}
              {item.date && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {format(new Date(item.date), "d MMM yyyy")}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
