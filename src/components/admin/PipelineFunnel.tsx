"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ROUTES } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PipelineCounts } from "@/types";

/** Funnel bar colours, deepening blue from Applied → Post-Selection. */
const FUNNEL_COLORS = [
  "#5dade2",
  "#3498db",
  "#2e86c1",
  "#2670a6",
  "#1f5e8a",
  "#1b3a6b",
];

/**
 * Horizontal funnel of the recruitment pipeline (Recharts). Each bar is a stage;
 * clicking one drills into the candidates list filtered to that stage.
 */
export function PipelineFunnel({ data }: { data: PipelineCounts }) {
  const t = useTranslations("admin.dashboard.pipeline");
  const router = useRouter();
  const isEmpty = data.every((d) => d.count === 0);

  function drillDown(stage: string) {
    router.push(`${ROUTES.ADMIN}/candidates?stage=${stage}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
              barCategoryGap="22%"
            >
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                stroke="var(--color-muted-foreground)"
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fontSize: 12 }}
                stroke="var(--color-muted-foreground)"
              />
              <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Bar
                dataKey="count"
                name={t("series")}
                radius={[0, 6, 6, 0]}
                maxBarSize={34}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.stage}
                    fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]}
                    cursor="pointer"
                    onClick={() => drillDown(entry.stage)}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  className="fill-foreground text-xs font-semibold"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
