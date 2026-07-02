import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { authService, jobPostService } from "@/lib/services";
import { ROUTES, ADMIN_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { JobForm } from "@/components/admin/jobs";

export const metadata: Metadata = { title: "Edit Job Post — SIORP Admin" };

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function EditJobPage({ params }: PageProps) {
  const user = await authService.getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) redirect(ROUTES.LOGIN);

  const { jobId } = await params;

  const [formData, detail, clients] = await Promise.all([
    jobPostService.getJobPostFormData(jobId),
    jobPostService.getJobPostDetail(jobId),
    jobPostService.getClientList(),
  ]);

  if (!formData || !detail) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link href={`${ROUTES.ADMIN}/jobs/${jobId}`}>
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Job Post</h1>
          <p className="text-muted-foreground text-sm">{detail.title}</p>
        </div>
      </div>

      <JobForm
        mode="edit"
        jobId={jobId}
        initialData={formData}
        clients={clients}
        assessment={detail.assessment}
        interviewSet={detail.interviewSet}
      />
    </div>
  );
}
