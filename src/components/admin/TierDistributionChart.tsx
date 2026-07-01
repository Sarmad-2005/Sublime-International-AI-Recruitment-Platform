"use client";

import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { CandidateTier } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TierDistribution } from "@/types";

/** Per-tier slice colours. */
const TIER_COLORS: Record<CandidateTier, string> = {
  DIAMOND: "#38bdf8",
  PLATINUM: "#94a3b8",
  GOLD: "#d4af37",
  BRONZE: "#b45309",
  PENDING: "#cbd5e1",
  REJECTED: "#ef4444",
};

/** Donut chart of the candidate tier breakdown (Recharts). */
export function TierDistributionChart({ data }: { data: TierDistribution }) {
  const t = useTranslations("admin.dashboard.tiers");
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const slices = data.filter((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="var(--color-card)"
                    strokeWidth={2}
                  >
                    {slices.map((entry) => (
                      <Cell key={entry.tier} fill={TIER_COLORS[entry.tier]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Total in the donut hole */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{total}</span>
                <span className="text-muted-foreground text-xs">
                  {t("centerLabel")}
                </span>
              </div>
            </div>

            {/* Legend with counts */}
            <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
              {data.map((entry) => (
                <li key={entry.tier} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[entry.tier] }}
                  />
                  <span className="text-muted-foreground truncate">
                    {entry.label}
                  </span>
                  <span className="ml-auto font-medium tabular-nums">
                    {entry.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
