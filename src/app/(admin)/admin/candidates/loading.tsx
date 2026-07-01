import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI for the candidates list. Next.js shows this while the
 * Server Component awaits getCandidates()/getJobPostsSummary(), so the filter
 * bar and table appear as skeletons instead of a blank screen.
 */
export default function CandidatesListLoading() {
  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Filters bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-36" />
          ))}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-40" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
