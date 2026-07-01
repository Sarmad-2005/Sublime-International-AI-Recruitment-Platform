import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { authService, jobPostService } from "@/lib/services";
import { ROUTES, USER_ROLES, JOBS_PAGE_SIZE, type JobPostStatus } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { JobsTable } from "./_components/JobsTable";
import { JobsFiltersBar } from "./_components/JobsFiltersBar";

export const metadata: Metadata = { title: "Job Posts — SIORP Admin" };

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

interface PageSearchParams {
  status?: string;
  sector?: string;
  clientId?: string;
  page?: string;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const filters = {
    status: (params.status as JobPostStatus) || null,
    sector: params.sector || null,
    clientId: params.clientId || null,
  };

  const [result, clients] = await Promise.all([
    jobPostService.getJobPosts(filters, { page, pageSize: JOBS_PAGE_SIZE }),
    jobPostService.getClientList(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Job Posts</h1>
          <p className="text-muted-foreground text-sm">
            {result.total.toLocaleString()} job{result.total !== 1 ? "s" : ""} found
          </p>
        </div>
        <Button asChild className="bg-royal hover:bg-royal/90 gap-2 text-white">
          <Link href={`${ROUTES.ADMIN}/jobs/new`}>
            <Plus className="size-4" />
            Create Job Post
          </Link>
        </Button>
      </div>

      <JobsFiltersBar filters={filters} clients={clients} />

      <JobsTable data={result} page={page} />
    </div>
  );
}
