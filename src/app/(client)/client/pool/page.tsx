import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { authService, clientPortalService } from "@/lib/services";
import { ROUTES, USER_ROLES, type CandidateTier } from "@/lib/constants";
import { clientPoolFiltersSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { PoolFilters } from "@/components/client/PoolFilters";
import { CandidateCard } from "@/components/client/CandidateCard";
import type { ClientReviewStatusValue } from "@/types";

export const metadata: Metadata = {
  title: "Talent Pool — Sublime International",
};

interface PoolPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Saudi Client Talent Pool (Server Component). Filters live in the URL. */
export default async function ClientPoolPage({ searchParams }: PoolPageProps) {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.SAUDI_CLIENT) {
    redirect(ROUTES.LOGIN);
  }

  const raw = await searchParams;
  const parsed = clientPoolFiltersSchema.safeParse(raw);
  const filters = parsed.success
    ? parsed.data
    : { jobPostId: null, tier: null, status: null, q: null, page: 1 };

  const pool = await clientPortalService.getAssignedCandidatePool(user.id, {
    jobPostId: filters.jobPostId ?? null,
    tier: (filters.tier as CandidateTier | null) ?? null,
    status: (filters.status as ClientReviewStatusValue | null) ?? null,
    q: filters.q ?? null,
    page: filters.page ?? 1,
  });

  const buildPageHref = (page: number): string => {
    const params = new URLSearchParams();
    if (filters.jobPostId) params.set("jobPostId", filters.jobPostId);
    if (filters.tier) params.set("tier", String(filters.tier));
    if (filters.status) params.set("status", String(filters.status));
    if (filters.q) params.set("q", filters.q);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${ROUTES.CLIENT}/pool?${qs}` : `${ROUTES.CLIENT}/pool`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Talent Pool</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {pool.total} candidate{pool.total === 1 ? "" : "s"} matched to your job
          requests.
        </p>
      </div>

      <PoolFilters
        positions={pool.positions}
        current={{
          jobPostId: filters.jobPostId ?? null,
          tier: filters.tier ? String(filters.tier) : null,
          status: filters.status ? String(filters.status) : null,
          q: filters.q ?? null,
        }}
      />

      {pool.items.length === 0 ? (
        <EmptyState hasQuery={Boolean(pool.total === 0)} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pool.items.map((candidate) => (
              <CandidateCard
                key={candidate.applicationId}
                candidate={candidate}
              />
            ))}
          </div>

          {pool.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {pool.page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildPageHref(pool.page - 1)}>Previous</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              )}
              <span className="text-muted-foreground px-2 text-sm">
                Page {pool.page} of {pool.totalPages}
              </span>
              {pool.page < pool.totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildPageHref(pool.page + 1)}>Next</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <span className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-full">
        <Users className="size-6" />
      </span>
      <p className="font-medium">No candidates found</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        {hasQuery
          ? "Your pool is empty for now. Our team will add matched candidates as they clear assessment and interview."
          : "No candidates match these filters. Try clearing them to see your full pool."}
      </p>
    </div>
  );
}
