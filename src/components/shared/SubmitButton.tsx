import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitButtonProps extends React.ComponentProps<typeof Button> {
  /** Whether the form is currently submitting. */
  pending: boolean;
  idleLabel: React.ReactNode;
  pendingLabel: React.ReactNode;
}

/**
 * Full-width brand submit button with a built-in loading state — the standard
 * primary action for every auth form.
 */
export function SubmitButton({
  pending,
  idleLabel,
  pendingLabel,
  className,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      variant="brand"
      size="lg"
      {...props}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn("w-full", className)}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        idleLabel
      )}
    </Button>
  );
}
