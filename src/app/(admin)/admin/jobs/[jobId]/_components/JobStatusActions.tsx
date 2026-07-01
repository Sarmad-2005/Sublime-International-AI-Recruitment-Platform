"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateJobStatusAction } from "@/app/(admin)/admin/jobs/actions";
import type { JobPostStatus } from "@/lib/constants";

interface JobStatusActionsProps {
  jobId: string;
  status: JobPostStatus;
}

export function JobStatusActions({ jobId, status }: JobStatusActionsProps) {
  const router = useRouter();

  async function set(newStatus: JobPostStatus, label: string) {
    const result = await updateJobStatusAction(jobId, newStatus);
    if (result.ok) {
      toast.success(`Job marked as ${label}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  if (status === "FILLED") return null;

  return (
    <div className="flex gap-2">
      {status !== "CLOSED" && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
          onClick={() => set("CLOSED", "Closed")}
        >
          <XCircle className="size-4" />
          Close Job
        </Button>
      )}
      {status === "CLOSED" && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
          onClick={() => set("ACTIVE", "Active")}
        >
          Reactivate
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
        onClick={() => set("FILLED", "Filled")}
      >
        <CheckCircle2 className="size-4" />
        Mark as Filled
      </Button>
    </div>
  );
}
