"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CANDIDATE_TIER_LABELS,
  CANDIDATE_TIERS,
  type CandidateTier,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { overrideTierAction } from "@/app/(admin)/admin/candidates/actions";

const OVERRIDEABLE_TIERS: CandidateTier[] = [
  "DIAMOND",
  "PLATINUM",
  "GOLD",
  "BRONZE",
  "REJECTED",
];

const TIER_COLORS: Record<CandidateTier, string> = {
  DIAMOND: "text-cyan-600",
  PLATINUM: "text-slate-500",
  GOLD: "text-amber-500",
  BRONZE: "text-orange-600",
  REJECTED: "text-red-500",
  PENDING: "text-muted-foreground",
};

interface TierOverrideModalProps {
  applicationId: string;
  currentTier: CandidateTier;
  candidateName: string;
}

export function TierOverrideModal({
  applicationId,
  currentTier,
  candidateName,
}: TierOverrideModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<CandidateTier>(
    OVERRIDEABLE_TIERS.includes(currentTier) ? currentTier : "GOLD",
  );
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const MIN_REASON = 20;
  const reasonShort = reason.trim().length < MIN_REASON;

  function handleSubmit() {
    startTransition(async () => {
      const result = await overrideTierAction(applicationId, tier, reason);
      if (result.ok) {
        toast.success(`Tier overridden to ${CANDIDATE_TIER_LABELS[tier]}`);
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldAlert className="size-4" />
          Override Tier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Override Tier — {candidateName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as CandidateTier)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OVERRIDEABLE_TIERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className={TIER_COLORS[t]}>{CANDIDATE_TIER_LABELS[t]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Reason{" "}
              <span className="text-muted-foreground font-normal">
                (min {MIN_REASON} chars)
              </span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the automated tier is being overridden…"
              rows={3}
            />
            {reason.length > 0 && reasonShort && (
              <p className="text-xs text-red-500">
                {MIN_REASON - reason.trim().length} more character
                {MIN_REASON - reason.trim().length !== 1 ? "s" : ""} required
              </p>
            )}
          </div>

          <p className="text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            This action is logged. The original computed tier is preserved in the
            audit trail.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || reasonShort}
              className={cn(isPending && "opacity-70")}
            >
              {isPending ? "Applying…" : "Apply Override"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
