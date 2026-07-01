"use client";

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { JobMetrics } from "@/types";

const STAGE_COLORS: Record<string, string> = {
  APPLIED: "#94a3b8",
  ASSESSMENT_PENDING: "#60a5fa",
  ASSESSMENT_PASSED: "#3b82f6",
  ASSESSMENT_FAILED: "#f87171",
  INTERVIEW_INVITED: "#818cf8",
  INTERVIEW_IN_PROGRESS: "#6366f1",
  INTERVIEW_COMPLETED: "#4f46e5",
  TIERED: "#2dd4bf",
  IN_CLIENT_POOL: "#14b8a6",
  CLIENT_SHORTLISTED: "#0d9488",
  LIVE_INTERVIEW_SCHEDULED: "#a78bfa",
  SELECTED: "#22c55e",
  POST_SELECTION: "#16a34a",
  DEPLOYED: "#15803d",
  REJECTED: "#ef4444",
  WITHDRAWN: "#9ca3af",
};

interface ApplicationFunnelMiniProps {
  metrics: JobMetrics;
}

export function ApplicationFunnelMini({ metrics }: ApplicationFunnelMiniProps) {
  const data = metrics.byStage
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-gray-400">
        No applications yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary stats row */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {[
          { label: "Total", value: metrics.totalApplications, color: "text-foreground" },
          { label: "Assessed", value: metrics.passedAssessment, color: "text-blue-600" },
          { label: "Interviewed", value: metrics.completedInterview, color: "text-indigo-600" },
          { label: "Shortlisted", value: metrics.shortlisted, color: "text-teal-600" },
          { label: "Selected", value: metrics.selected, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-md bg-gray-50 px-3 py-2 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-muted-foreground text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <Tooltip
            formatter={(value) => [value ?? 0, "Applications"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={STAGE_COLORS[entry.status] ?? "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
