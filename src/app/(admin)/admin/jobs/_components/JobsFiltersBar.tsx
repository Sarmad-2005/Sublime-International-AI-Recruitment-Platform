"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { X } from "lucide-react";

import {
  JOB_POST_STATUS_VALUES,
  JOB_SECTOR_LABELS,
  JOB_SECTOR_VALUES,
  type JobPostStatus,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminJobFilters } from "@/types";

const STATUS_LABELS: Record<JobPostStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  CLOSED: "Closed",
  FILLED: "Filled",
};

interface JobsFiltersBarProps {
  filters: AdminJobFilters;
  clients: Array<{ id: string; companyName: string }>;
}

export function JobsFiltersBar({ filters, clients }: JobsFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const push = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router],
  );

  const hasFilters = filters.status || filters.sector || filters.clientId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status filter */}
      <Select
        value={filters.status ?? "__all__"}
        onValueChange={(v) => push({ status: v === "__all__" ? null : v })}
      >
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Statuses</SelectItem>
          {JOB_POST_STATUS_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sector filter */}
      <Select
        value={filters.sector ?? "__all__"}
        onValueChange={(v) => push({ sector: v === "__all__" ? null : v })}
      >
        <SelectTrigger className="h-9 w-52">
          <SelectValue placeholder="All Sectors" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Sectors</SelectItem>
          {JOB_SECTOR_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {JOB_SECTOR_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Saudi Client filter */}
      <Select
        value={filters.clientId ?? "__all__"}
        onValueChange={(v) => push({ clientId: v === "__all__" ? null : v })}
      >
        <SelectTrigger className="h-9 w-52">
          <SelectValue placeholder="All Clients" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Clients</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.companyName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => push({ status: null, sector: null, clientId: null })}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
