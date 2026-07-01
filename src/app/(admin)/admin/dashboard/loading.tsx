import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCardSkeleton } from "@/components/admin";

/** Skeleton placeholder for a chart/table card. */
function PanelSkeleton({ bodyClassName }: { bodyClassName: string }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className={bodyClassName} />
      </CardContent>
    </Card>
  );
}

/**
 * Route-level loading UI. Next.js shows this automatically while the dashboard
 * Server Component awaits its data, so the layout (cards, charts, table) appears
 * as skeletons instead of a blank screen.
 */
export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PanelSkeleton bodyClassName="h-72 w-full" />
        </div>
        <div className="lg:col-span-1">
          <PanelSkeleton bodyClassName="h-56 w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PanelSkeleton bodyClassName="h-48 w-full" />
        </div>
        <div className="lg:col-span-2">
          <PanelSkeleton bodyClassName="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
