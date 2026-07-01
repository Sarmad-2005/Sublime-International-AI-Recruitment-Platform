"use client";

import { Building2, Calendar, MapPin, Users, Banknote, Clock } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { JOB_SECTOR_LABELS, JOB_BENEFIT_LABELS, type JobBenefit } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import type { AdminJobFormData } from "@/types";

interface JobCardProps {
  data: Partial<AdminJobFormData>;
  companyName: string;
}

export function JobCard({ data, companyName }: JobCardProps) {
  const sectorLabel = data.sector
    ? (JOB_SECTOR_LABELS[data.sector as keyof typeof JOB_SECTOR_LABELS] ?? data.sector)
    : "—";

  const location = [data.city, data.country].filter(Boolean).join(", ") || "Saudi Arabia";

  const salary =
    data.salaryMin && data.salaryMax
      ? `SAR ${data.salaryMin.toLocaleString()} – ${data.salaryMax.toLocaleString()} / month`
      : data.salaryMin
        ? `From SAR ${data.salaryMin.toLocaleString()} / month`
        : data.salaryMax
          ? `Up to SAR ${data.salaryMax.toLocaleString()} / month`
          : null;

  const deadlineDate = data.applicationDeadline ? new Date(data.applicationDeadline) : null;
  const isExpired = deadlineDate ? deadlineDate < new Date() : false;

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      {/* Header band */}
      <div className="bg-navy rounded-t-xl px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">
              {data.title || "Job Title"}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 text-white/70">
              <Building2 className="size-3.5" />
              <span className="text-sm">{companyName || "Company Name"}</span>
            </div>
          </div>
          <Badge className="bg-gold text-navy shrink-0 font-semibold">
            {sectorLabel}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 px-5 py-4">
        {/* Key stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<MapPin className="size-4" />} label="Location" value={location} />
          <Stat
            icon={<Users className="size-4" />}
            label="Vacancies"
            value={`${data.vacancies ?? 1} position${(data.vacancies ?? 1) !== 1 ? "s" : ""}`}
          />
          {salary && (
            <Stat icon={<Banknote className="size-4" />} label="Salary" value={salary} />
          )}
          {data.contractDurationMonths && (
            <Stat
              icon={<Clock className="size-4" />}
              label="Contract"
              value={`${data.contractDurationMonths} months`}
            />
          )}
        </div>

        {/* Description preview */}
        {data.description && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              About the Role
            </p>
            <div
              className="prose prose-sm text-muted-foreground max-w-none line-clamp-4"
              dangerouslySetInnerHTML={{ __html: data.description }}
            />
          </div>
        )}

        {/* Benefits */}
        {(data.benefits ?? []).length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Benefits
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(data.benefits ?? []).map((b) => (
                <Badge key={b} variant="secondary" className="text-xs">
                  {JOB_BENEFIT_LABELS[b as JobBenefit] ?? b}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Deadline */}
        {deadlineDate && (
          <div className="flex items-center gap-1.5 pt-1">
            <Calendar className={cn("size-4", isExpired ? "text-red-500" : "text-muted-foreground")} />
            <span className={cn("text-sm", isExpired ? "text-red-500 font-medium" : "text-muted-foreground")}>
              {isExpired
                ? `Deadline passed (${format(deadlineDate, "d MMM yyyy")})`
                : `Apply by ${format(deadlineDate, "d MMM yyyy")}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <div className="text-muted-foreground mb-0.5 flex items-center gap-1 text-xs">
        {icon}
        {label}
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
