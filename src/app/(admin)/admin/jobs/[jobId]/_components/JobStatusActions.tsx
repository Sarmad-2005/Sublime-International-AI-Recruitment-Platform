"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateJobStatusAction } from "@/app/(admin)/admin/jobs/actions";
import type { JobPostStatus } from "@/lib/constants";

interface JobStatusActionsProps {
  jobId: string;
  status: JobPostStatus;
}

export function JobStatusActions({ jobId, status }: JobStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<JobPostStatus | null>(null);

  async function set(newStatus: JobPostStatus, label: string) {
    setPending(newStatus);
    try {
      const result = await updateJobStatusAction(jobId, newStatus);
      if (result.ok) {
        toast.success(`Job marked as ${label}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setPending(null);
    }
  }

  if (status === "FILLED") return null;

  const busy = pending !== null;

  return (
    <div className="flex gap-2">
      {status !== "CLOSED" && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
          disabled={busy}
          onClick={() => set("CLOSED", "Closed")}
        >
          {pending === "CLOSED" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <XCircle className="size-4" />
          )}
          Close Job
        </Button>
      )}
      {status === "CLOSED" && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
          disabled={busy}
          onClick={() => set("ACTIVE", "Active")}
        >
          {pending === "ACTIVE" && <Loader2 className="size-4 animate-spin" />}
          Reactivate
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
        disabled={busy}
        onClick={() => set("FILLED", "Filled")}
      >
        {pending === "FILLED" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        Mark as Filled
      </Button>
    </div>
  );
}
