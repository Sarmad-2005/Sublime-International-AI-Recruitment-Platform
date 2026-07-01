import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { authService, jobPostService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { JobForm } from "@/components/admin/jobs";

export const metadata: Metadata = { title: "Create Job Post — SIORP Admin" };

const ADMIN_ROLES: readonly string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN];

export default async function NewJobPage() {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const clients = await jobPostService.getClientList();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link href={`${ROUTES.ADMIN}/jobs`}>
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Job Post</h1>
          <p className="text-muted-foreground text-sm">
            Fill in the sections below. Save to publish or keep as a draft.
          </p>
        </div>
      </div>

      <JobForm mode="create" clients={clients} />
    </div>
  );
}
