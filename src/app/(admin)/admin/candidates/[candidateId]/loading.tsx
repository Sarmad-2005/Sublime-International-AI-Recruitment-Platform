import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI for the candidate detail page. Shown while the Server
 * Component awaits getCandidateDetail()/getSaudiClients(), rendering the header,
 * stage bar and tab area as skeletons instead of a blank screen.
 */
export default function CandidateDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />

      {/* Header card */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stage bar */}
      <Card>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>

      {/* Tab content */}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 py-4">
              <Skeleton className="h-3 w-32" />
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-5 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
