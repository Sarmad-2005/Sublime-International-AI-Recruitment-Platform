"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInterviewSetAction } from "../actions";
import type { LinkableJob } from "@/types";

export function CreateInterviewSetDialog({
  linkableJobs,
}: {
  linkableJobs: LinkableJob[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jobPostId, setJobPostId] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function onSelectJob(id: string) {
    setJobPostId(id);
    if (!title.trim()) {
      const job = linkableJobs.find((j) => j.id === id);
      if (job) setTitle(`${job.title} — AI Interview`);
    }
  }

  async function handleCreate() {
    if (!jobPostId) {
      toast.error("Select a job to link the set to");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createInterviewSetAction({ jobPostId, title: title.trim() });
      if (result.ok) {
        toast.success("Interview set created");
        router.push(`${ROUTES.ADMIN}/interview-sets/${result.data.id}`);
      } else {
        toast.error(result.error);
        setSubmitting(false);
      }
    } catch {
      toast.error("Failed to create interview set");
      setSubmitting(false);
    }
  }

  const noJobs = linkableJobs.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-royal hover:bg-royal/90 gap-2 text-white">
          <Plus className="size-4" />
          Create New Interview Set
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New AI Interview Set</DialogTitle>
          <DialogDescription>
            Each set is linked to one job post. You&apos;ll add questions and
            settings next.
          </DialogDescription>
        </DialogHeader>

        {noJobs ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
            Every job already has an interview set. Create a new job post first.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-sm">
                Linked Job <span className="text-red-500">*</span>
              </Label>
              <Select value={jobPostId} onValueChange={onSelectJob}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job post…" />
                </SelectTrigger>
                <SelectContent>
                  {linkableJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                      <span className="text-muted-foreground ml-1 text-xs">
                        — {job.companyName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1 block text-sm">
                Set Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Electrician — AI Interview"
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-royal hover:bg-royal/90 gap-1.5 text-white"
                onClick={handleCreate}
                disabled={submitting || !jobPostId || title.trim().length < 2}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Create Set
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
