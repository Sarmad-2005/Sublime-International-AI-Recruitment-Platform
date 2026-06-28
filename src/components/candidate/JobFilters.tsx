"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import {
  JOB_SECTOR_VALUES,
  JOB_SECTOR_LABELS,
  type JobSector,
} from "@/lib/constants";
import {
  SALARY_FILTER_OPTIONS,
  DATE_POSTED_OPTIONS,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { JobBoardQuery } from "@/types";

/** Sentinel value for "no filter" — radix Select can't use an empty string. */
const ALL = "all";

export interface JobFilterValues {
  sector: string | null;
  country: string | null;
  salaryMin: number | null;
  postedWithinDays: number | null;
}

interface JobFiltersProps {
  values: JobFilterValues;
  /** Distinct destination countries available as filter options. */
  countries: string[];
  /** Whether any filter (incl. search) is currently active. */
  hasActiveFilters: boolean;
  onChange: (patch: Partial<JobBoardQuery>) => void;
  onClear: () => void;
}

/**
 * Job Board filter sidebar (Client Component): Sector, Country, Minimum salary,
 * Date posted. Each change is pushed up to the board, which writes it to the URL
 * (the single source of truth) and lets React Query refetch.
 */
export function JobFilters({
  values,
  countries,
  hasActiveFilters,
  onChange,
  onClear,
}: JobFiltersProps) {
  const t = useTranslations("candidate.jobs");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("filtersHeading")}</h2>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-auto px-2 py-1 text-xs"
            onClick={onClear}
          >
            <X className="size-3.5" />
            {t("clearFilters")}
          </Button>
        )}
      </div>

      {/* Sector */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("sectorLabel")}</Label>
        <Select
          value={values.sector ?? ALL}
          onValueChange={(v) =>
            onChange({ sector: v === ALL ? null : (v as JobSector) })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("anySector")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("anySector")}</SelectItem>
            {JOB_SECTOR_VALUES.map((sector) => (
              <SelectItem key={sector} value={sector}>
                {JOB_SECTOR_LABELS[sector]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Country */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("countryLabel")}</Label>
        <Select
          value={values.country ?? ALL}
          onValueChange={(v) => onChange({ country: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("anyCountry")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("anyCountry")}</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Minimum salary */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("salaryLabel")}</Label>
        <Select
          value={values.salaryMin != null ? String(values.salaryMin) : ALL}
          onValueChange={(v) =>
            onChange({ salaryMin: v === ALL ? null : Number(v) })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("anySalary")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("anySalary")}</SelectItem>
            {SALARY_FILTER_OPTIONS.map((amount) => (
              <SelectItem key={amount} value={String(amount)}>
                {t("salaryOption", {
                  currency: "SAR",
                  amount: amount.toLocaleString(),
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date posted */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("datePostedLabel")}</Label>
        <Select
          value={
            values.postedWithinDays != null
              ? String(values.postedWithinDays)
              : ALL
          }
          onValueChange={(v) =>
            onChange({ postedWithinDays: v === ALL ? null : Number(v) })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("anyDate")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("anyDate")}</SelectItem>
            {DATE_POSTED_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
