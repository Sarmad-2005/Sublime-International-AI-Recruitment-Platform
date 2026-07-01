"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.candidates.tierModal");
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
        toast.success(t("successToast", { tier: CANDIDATE_TIER_LABELS[tier] }));
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
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: candidateName })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("newTier")}</Label>
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
              {t("reason")}{" "}
              <span className="text-muted-foreground font-normal">
                {t("reasonHint", { min: MIN_REASON })}
              </span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              rows={3}
            />
            {reason.length > 0 && reasonShort && (
              <p className="text-xs text-red-500">
                {t("charsRequired", { count: MIN_REASON - reason.trim().length })}
              </p>
            )}
          </div>

          <p className="text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            {t("logNotice")}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || reasonShort}
              className={cn(isPending && "opacity-70")}
            >
              {isPending ? t("applying") : t("apply")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
