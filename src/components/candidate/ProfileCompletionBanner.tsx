import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ProfileCompletion } from "@/types";

/**
 * "Complete your profile" call-to-action — only rendered while the profile is
 * below 100%. Lists the first few missing fields to nudge the candidate.
 */
export function ProfileCompletionBanner({
  completion,
}: {
  completion: ProfileCompletion;
}) {
  const t = useTranslations("candidate.dashboard");

  if (completion.overall >= 100) return null;

  const preview = completion.missingFields.slice(0, 4);

  return (
    <div className="from-navy to-navy-light text-white flex flex-col gap-4 rounded-xl bg-gradient-to-r p-5 sm:flex-row sm:items-center">
      <div className="bg-gold/20 text-gold hidden size-12 shrink-0 place-items-center rounded-full sm:grid">
        <Sparkles className="size-6" />
      </div>
      <div className="flex-1 space-y-2">
        <h2 className="font-semibold">{t("completeProfileTitle")}</h2>
        <p className="text-sm text-white/80">
          {t("completeProfileBody", { percent: completion.overall })}
        </p>
        <Progress
          value={completion.overall}
          className="bg-white/20"
          indicatorClassName="bg-gold"
        />
        {preview.length > 0 && (
          <p className="text-xs text-white/70">
            {t("missingPrefix")} {preview.join(" · ")}
          </p>
        )}
      </div>
      <Button asChild variant="brand" className="shrink-0">
        <Link href={`${ROUTES.CANDIDATE}/profile`}>
          {t("completeProfileCta")}
        </Link>
      </Button>
    </div>
  );
}
