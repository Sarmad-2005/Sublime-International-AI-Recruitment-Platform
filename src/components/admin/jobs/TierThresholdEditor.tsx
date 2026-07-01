"use client";

import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TierThresholds } from "@/types";

interface TierThresholdEditorProps {
  thresholds: TierThresholds;
  onThresholdsChange: (t: TierThresholds) => void;
  assessmentWeight: number;
  interviewWeight: number;
  onAssessmentWeightChange: (v: number) => void;
  onInterviewWeightChange: (v: number) => void;
}

const TIERS: { key: keyof TierThresholds; label: string; color: string }[] = [
  { key: "diamondMin", label: "Diamond", color: "text-cyan-600" },
  { key: "platinumMin", label: "Platinum", color: "text-slate-500" },
  { key: "goldMin", label: "Gold", color: "text-amber-500" },
  { key: "bronzeMin", label: "Bronze", color: "text-orange-500" },
];

export function TierThresholdEditor({
  thresholds,
  onThresholdsChange,
  assessmentWeight,
  interviewWeight,
  onAssessmentWeightChange,
  onInterviewWeightChange,
}: TierThresholdEditorProps) {
  const weightSum = assessmentWeight + interviewWeight;
  const weightError = Math.abs(weightSum - 100) > 0.01;

  function setThreshold(key: keyof TierThresholds, raw: string) {
    const v = Math.min(100, Math.max(0, parseInt(raw, 10) || 0));
    onThresholdsChange({ ...thresholds, [key]: v });
  }

  function thresholdError(): string | null {
    if (thresholds.diamondMin <= thresholds.platinumMin) return "Diamond must be higher than Platinum";
    if (thresholds.platinumMin <= thresholds.goldMin) return "Platinum must be higher than Gold";
    if (thresholds.goldMin <= thresholds.bronzeMin) return "Gold must be higher than Bronze";
    return null;
  }

  const tierErr = thresholdError();

  return (
    <div className="space-y-6">
      {/* Weight inputs */}
      <div>
        <p className="mb-3 text-sm font-semibold">Scoring Weights</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="assessmentWeight" className="text-xs">
              Assessment Weight (%)
            </Label>
            <Input
              id="assessmentWeight"
              type="number"
              min={0}
              max={100}
              value={assessmentWeight}
              onChange={(e) => onAssessmentWeightChange(parseFloat(e.target.value) || 0)}
              className={cn("mt-1", weightError && "border-red-400")}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="interviewWeight" className="text-xs">
              Interview Weight (%)
            </Label>
            <Input
              id="interviewWeight"
              type="number"
              min={0}
              max={100}
              value={interviewWeight}
              onChange={(e) => onInterviewWeightChange(parseFloat(e.target.value) || 0)}
              className={cn("mt-1", weightError && "border-red-400")}
            />
          </div>
          <div className="col-span-2 sm:col-span-2 flex items-end pb-0.5">
            <div
              className={cn(
                "flex-1 rounded-md px-4 py-2.5 text-sm font-semibold text-center",
                weightError
                  ? "bg-red-50 text-red-600 border border-red-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200",
              )}
            >
              {weightError ? (
                <span className="flex items-center justify-center gap-1.5">
                  <AlertCircle className="size-4" />
                  Sum = {weightSum.toFixed(0)}% (must be 100%)
                </span>
              ) : (
                `✓ Sum = 100%`
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tier cut-offs table */}
      <div>
        <p className="mb-3 text-sm font-semibold">Tier Score Cut-offs</p>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-left">
                <th className="px-4 py-2.5 font-semibold">Tier</th>
                <th className="px-4 py-2.5 font-semibold">Minimum Score (%)</th>
                <th className="text-muted-foreground px-4 py-2.5 font-normal">Range</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {TIERS.map(({ key, label, color }, idx) => {
                return (
                  <tr key={key} className="hover:bg-muted/20">
                    <td className={cn("px-4 py-3 font-semibold", color)}>{label}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">≥</span>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={thresholds[key]}
                          onChange={(e) => setThreshold(key, e.target.value)}
                          className="h-8 w-24"
                        />
                        <span className="text-muted-foreground text-xs">%</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {idx === 0
                        ? `${thresholds.diamondMin}% – 100%`
                        : idx === 1
                          ? `${thresholds.platinumMin}% – ${thresholds.diamondMin - 1}%`
                          : idx === 2
                            ? `${thresholds.goldMin}% – ${thresholds.platinumMin - 1}%`
                            : `${thresholds.bronzeMin}% – ${thresholds.goldMin - 1}%`}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/20">
                <td className="text-muted-foreground px-4 py-3 text-sm italic">Rejected</td>
                <td className="px-4 py-3" />
                <td className="text-muted-foreground px-4 py-3 text-xs">
                  0% – {thresholds.bronzeMin - 1}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {tierErr && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="size-4" />
            {tierErr}
          </p>
        )}
      </div>
    </div>
  );
}
