import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Accent colours available for the metric icon. */
export type MetricColor = "royal" | "gold" | "emerald" | "navy";

const ICON_COLORS: Record<MetricColor, string> = {
  royal: "bg-royal/10 text-royal",
  gold: "bg-gold/10 text-gold",
  emerald: "bg-emerald-500/10 text-emerald-600",
  navy: "bg-navy/10 text-navy",
};

interface MetricCardProps {
  title: string;
  value: number | string;
  /** Signed percent change vs the previous period, or `null` to hide the trend. */
  change?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  color?: MetricColor;
  /** Render the skeleton placeholder instead of the value. */
  loading?: boolean;
}

/** A single headline metric tile for the admin dashboard. */
export function MetricCard({
  title,
  value,
  change = null,
  icon: Icon,
  color = "royal",
  loading = false,
}: MetricCardProps) {
  const t = useTranslations("admin.dashboard.metrics");

  if (loading) return <MetricCardSkeleton />;

  const formatted = typeof value === "number" ? value.toLocaleString() : value;
  const hasChange = change !== null && change !== undefined;
  const isUp = hasChange && change >= 0;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-muted-foreground truncate text-sm font-medium">
            {title}
          </p>
          <p className="text-3xl font-bold tabular-nums">{formatted}</p>
          {hasChange && (
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                isUp ? "text-emerald-600" : "text-red-600",
              )}
            >
              <TrendIcon className="size-3.5" />
              <span className="tabular-nums">
                {isUp ? "+" : ""}
                {change}%
              </span>
              <span className="text-muted-foreground font-normal">
                {t("vsLastPeriod")}
              </span>
            </p>
          )}
        </div>
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-lg",
            ICON_COLORS[color],
          )}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

/** Loading placeholder matching the `MetricCard` layout. */
export function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="size-11 rounded-lg" />
      </CardContent>
    </Card>
  );
}
