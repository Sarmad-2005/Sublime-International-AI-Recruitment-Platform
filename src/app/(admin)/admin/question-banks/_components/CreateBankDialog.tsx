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
import { createBankAction } from "../actions";
import type { LinkableJob } from "@/types";

export function CreateBankDialog({ linkableJobs }: { linkableJobs: LinkableJob[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jobPostId, setJobPostId] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function onSelectJob(id: string) {
    setJobPostId(id);
    if (!title.trim()) {
      const job = linkableJobs.find((j) => j.id === id);
      if (job) setTitle(`${job.title} — Trade Assessment`);
    }
  }

  async function handleCreate() {
    if (!jobPostId) {
      toast.error("Select a job to link the bank to");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createBankAction({ jobPostId, title: title.trim() });
      if (result.ok) {
        toast.success("Question bank created");
        router.push(`${ROUTES.ADMIN}/question-banks/${result.data.id}`);
      } else {
        toast.error(result.error);
        setSubmitting(false);
      }
    } catch {
      toast.error("Failed to create question bank");
      setSubmitting(false);
    }
  }

  const noJobs = linkableJobs.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-royal hover:bg-royal/90 gap-2 text-white">
          <Plus className="size-4" />
          Create New Question Bank
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Question Bank</DialogTitle>
          <DialogDescription>
            Each bank is linked to one job post. You&apos;ll add questions and
            settings next.
          </DialogDescription>
        </DialogHeader>

        {noJobs ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
            Every job already has a question bank. Create a new job post first.
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
                Bank Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Electrician — Trade Assessment"
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
                Create Bank
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
