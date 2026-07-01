"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { MoveRight } from "lucide-react";

import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveCandidateStageAction } from "@/app/(admin)/admin/candidates/actions";

const STAGE_OPTIONS: { label: string; value: ApplicationStatus }[] = [
  { label: "Applied", value: "APPLIED" },
  { label: "Assessment Pending", value: "ASSESSMENT_PENDING" },
  { label: "Assessment Passed", value: "ASSESSMENT_PASSED" },
  { label: "Assessment Failed", value: "ASSESSMENT_FAILED" },
  { label: "Interview Invited", value: "INTERVIEW_INVITED" },
  { label: "Interview Completed", value: "INTERVIEW_COMPLETED" },
  { label: "Tiered", value: "TIERED" },
  { label: "In Client Pool", value: "IN_CLIENT_POOL" },
  { label: "Client Shortlisted", value: "CLIENT_SHORTLISTED" },
  { label: "Live Interview Scheduled", value: "LIVE_INTERVIEW_SCHEDULED" },
  { label: "Selected", value: "SELECTED" },
  { label: "Post-Selection", value: "POST_SELECTION" },
  { label: "Deployed", value: "DEPLOYED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Withdrawn", value: "WITHDRAWN" },
];

export function MoveStageSelectorClient({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const status = value as ApplicationStatus;
    startTransition(async () => {
      const result = await moveCandidateStageAction(applicationId, status);
      if (result.ok) {
        toast.success(`Moved to "${APPLICATION_STATUS_LABELS[status] ?? status}"`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <MoveRight className="text-muted-foreground size-4 shrink-0" />
      <Select onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="Move to stage…" />
        </SelectTrigger>
        <SelectContent>
          {STAGE_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
