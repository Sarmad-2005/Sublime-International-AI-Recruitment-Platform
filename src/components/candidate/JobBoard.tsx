"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { useJobs, jobBoardSearchParams } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { JobCard } from "@/components/candidate/JobCard";
import { JobFilters } from "@/components/candidate/JobFilters";
import type { JobBoardQuery, JobBoardResult } from "@/types";

/** Read the JobBoardQuery out of the URL search params (the source of truth). */
function parseQuery(params: URLSearchParams): JobBoardQuery {
  const num = (key: string): number | null => {
    const raw = params.get(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const pageRaw = num("page");
  return {
    search: params.get("search") || null,
    sector: params.get("sector") || null,
    country: params.get("country") || null,
    salaryMin: num("salaryMin"),
    postedWithinDays: num("postedWithinDays"),
    page: pageRaw && pageRaw > 0 ? pageRaw : 1,
  };
}

interface JobBoardProps {
  initialData: JobBoardResult;
  initialQueryString: string;
}

/**
 * Job Board (Client Component). Owns nothing but the URL: every filter, search
 * term and page lives in `searchParams`, so the board is shareable/bookmarkable
 * and back/forward works. React Query (`useJobs`) fetches the matching page and
 * keeps the previous results visible while the next ones load. The server seeds
 * `initialData` for the first (SSR'd) query so there's no initial fetch flash.
 */
export function JobBoard({ initialData, initialQueryString }: JobBoardProps) {
  const t = useTranslations("candidate.jobs");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo(
    () => parseQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  // Seed React Query with the SSR data only when the URL matches the initial one.
  const seeded =
    jobBoardSearchParams(query) === initialQueryString ? initialData : undefined;
  const { data, isFetching, isError } = useJobs(query, seeded);

  const countries = data?.countries ?? initialData.countries;

  // --- URL writes -----------------------------------------------------------
  const commit = useCallback(
    (patch: Partial<JobBoardQuery>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());
      const apply = (key: string, value: string | number | null) => {
        if (value === null || value === "" || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      };
      if ("search" in patch) apply("search", patch.search ?? null);
      if ("sector" in patch) apply("sector", patch.sector ?? null);
      if ("country" in patch) apply("country", patch.country ?? null);
      if ("salaryMin" in patch) apply("salaryMin", patch.salaryMin ?? null);
      if ("postedWithinDays" in patch)
        apply("postedWithinDays", patch.postedWithinDays ?? null);
      if ("page" in patch) apply("page", patch.page && patch.page > 1 ? patch.page : null);
      if (resetPage && !("page" in patch)) params.delete("page");

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
    setSearchInput("");
  }, [pathname, router]);

  // --- Debounced search input ----------------------------------------------
  const [searchInput, setSearchInput] = useState(query.search ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync when the URL changes externally (back/forward, clear).
  useEffect(() => {
    setSearchInput(query.search ?? "");
  }, [query.search]);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commit({ search: value.trim() || null });
    }, 350);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit({ search: searchInput.trim() || null });
  }

  const hasActiveFilters =
    query.search != null ||
    query.sector != null ||
    query.country != null ||
    query.salaryMin != null ||
    query.postedWithinDays != null;

  const total = data?.total ?? initialData.total;
  const totalPages = data?.totalPages ?? initialData.totalPages;
  const items = data?.items ?? initialData.items;

  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <form onSubmit={onSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            aria-label={t("search")}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="lg:hidden"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal className="size-4" />
          {t("filtersHeading")}
        </Button>
      </form>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Filters sidebar */}
        <aside
          className={cn(
            "lg:bg-card shrink-0 lg:w-64 lg:rounded-xl lg:border lg:p-4",
            filtersOpen ? "block" : "hidden lg:block",
          )}
        >
          <JobFilters
            values={{
              sector: query.sector,
              country: query.country,
              salaryMin: query.salaryMin,
              postedWithinDays: query.postedWithinDays,
            }}
            countries={countries}
            hasActiveFilters={hasActiveFilters}
            onChange={commit}
            onClear={clearAll}
          />
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t("resultsCount", { count: total })}
            </p>
            {isFetching && (
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            )}
          </div>

          {isError ? (
            <Card>
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                {t("loadError")}
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-1 py-12 text-center">
                <p className="font-medium">{t("empty")}</p>
                <p className="text-muted-foreground text-sm">{t("emptyHint")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={query.page <= 1}
                onClick={() => commit({ page: query.page - 1 }, false)}
              >
                {t("previous")}
              </Button>
              <span className="text-muted-foreground text-sm">
                {t("page", { page: query.page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={query.page >= totalPages}
                onClick={() => commit({ page: query.page + 1 }, false)}
              >
                {t("next")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
