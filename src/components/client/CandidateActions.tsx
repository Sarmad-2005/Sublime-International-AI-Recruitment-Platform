"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Check, Heart, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { updateClientCandidateStatusAction } from "@/app/(client)/actions";
import type { ClientReviewStatusValue } from "@/types";

interface CandidateActionsProps {
  applicationId: string;
  status: ClientReviewStatusValue;
  /** Compact layout for the pool cards; full-width for the profile page. */
  variant?: "card" | "detail";
  className?: string;
}

type Choice = "INTERESTED" | "NOT_INTERESTED" | "SHORTLISTED_FOR_INTERVIEW";

/**
 * The three client-interest controls (Interested / Not Interested / Shortlist),
 * shared by the pool cards and the candidate profile page. Optimistically
 * reflects the choice, then persists via the server action.
 */
export function CandidateActions({
  applicationId,
  status,
  variant = "card",
  className,
}: CandidateActionsProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<ClientReviewStatusValue>(status);
  const [pending, startTransition] = useTransition();

  function choose(choice: Choice) {
    if (pending) return;
    const previous = current;
    setCurrent(choice);
    startTransition(async () => {
      const result = await updateClientCandidateStatusAction({
        applicationId,
        status: choice,
      });
      if (!result.ok) {
        setCurrent(previous);
        toast.error(result.error);
        return;
      }
      const messages: Record<Choice, string> = {
        INTERESTED: "Marked as interested.",
        NOT_INTERESTED: "Marked as not interested.",
        SHORTLISTED_FOR_INTERVIEW: "Shortlisted for a live interview.",
      };
      toast.success(messages[choice]);
      router.refresh();
    });
  }

  const full = variant === "detail";

  return (
    <div
      className={cn(
        "flex gap-2",
        full ? "flex-col sm:flex-row" : "flex-wrap",
        className,
      )}
    >
      <ActionButton
        active={current === "INTERESTED"}
        activeClass="border-rose-300 bg-rose-50 text-rose-700"
        onClick={() => choose("INTERESTED")}
        disabled={pending}
        full={full}
        icon={
          current === "INTERESTED" ? (
            <Check className="size-4" />
          ) : (
            <Heart className="size-4" />
          )
        }
        label="Interested"
      />
      <ActionButton
        active={current === "NOT_INTERESTED"}
        activeClass="border-slate-300 bg-slate-100 text-slate-700"
        onClick={() => choose("NOT_INTERESTED")}
        disabled={pending}
        full={full}
        icon={<X className="size-4" />}
        label="Not Interested"
      />
      <ActionButton
        active={current === "SHORTLISTED_FOR_INTERVIEW"}
        activeClass="border-navy bg-navy text-white"
        onClick={() => choose("SHORTLISTED_FOR_INTERVIEW")}
        disabled={pending}
        full={full}
        icon={<CalendarPlus className="size-4" />}
        label="Shortlist"
      />
    </div>
  );
}

function ActionButton({
  active,
  activeClass,
  onClick,
  disabled,
  full,
  icon,
  label,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  disabled: boolean;
  full: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        full ? "flex-1" : "flex-1 min-w-0",
        active && activeClass,
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}
