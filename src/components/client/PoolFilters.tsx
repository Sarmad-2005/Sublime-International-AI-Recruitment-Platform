"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import {
  CANDIDATE_TIER_LABELS,
  type CandidateTier,
} from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClientJobPosition } from "@/types";

const ALL = "ALL";

const TIER_OPTIONS: CandidateTier[] = ["DIAMOND", "PLATINUM", "GOLD", "BRONZE"];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "UNREVIEWED", label: "Unreviewed" },
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
  { value: "SHORTLISTED_FOR_INTERVIEW", label: "Shortlisted" },
];

interface PoolFiltersProps {
  positions: ClientJobPosition[];
  current: {
    jobPostId: string | null;
    tier: string | null;
    status: string | null;
    q: string | null;
  };
}

/** Talent-pool filter bar. All state lives in the URL searchParams. */
export function PoolFilters({ positions, current }: PoolFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value == null || value === ALL || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      params.delete("page"); // any filter change resets pagination
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  function onSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setParam("q", String(data.get("q") ?? "").trim() || null);
  }

  const hasFilters =
    current.jobPostId || current.tier || current.status || current.q;

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={onSearchSubmit} className="relative" role="search">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          name="q"
          type="search"
          defaultValue={current.q ?? ""}
          placeholder="Search candidates by name…"
          className="pl-9"
          aria-label="Search candidates"
        />
      </form>

      <div className="flex flex-wrap gap-3">
        {positions.length > 1 && (
          <Select
            value={current.jobPostId ?? ALL}
            onValueChange={(v) => setParam("jobPostId", v)}
          >
            <SelectTrigger className="w-auto min-w-44">
              <SelectValue placeholder="Job Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Positions</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={current.tier ?? ALL}
          onValueChange={(v) => setParam("tier", v)}
        >
          <SelectTrigger className="w-auto min-w-36">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Tiers</SelectItem>
            {TIER_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {CANDIDATE_TIER_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={current.status ?? ALL}
          onValueChange={(v) => setParam("status", v)}
        >
          <SelectTrigger className="w-auto min-w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(pathname)}
            className="text-muted-foreground"
          >
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
