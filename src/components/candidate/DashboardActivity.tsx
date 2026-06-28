import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";

import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CandidateActivityItem } from "@/types";

/** Recent-activity timeline — last 5 application status changes. */
export function DashboardActivity({
  items,
}: {
  items: CandidateActivityItem[];
}) {
  const t = useTranslations("candidate.dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("activityHeading")}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noActivity")}</p>
        ) : (
          <ol className="relative space-y-5 border-l pl-5">
            {items.map((item) => (
              <li key={item.id} className="relative">
                <span className="bg-royal absolute top-1 -left-[1.4rem] size-2.5 rounded-full ring-4 ring-background" />
                <p className="text-sm font-medium">
                  {APPLICATION_STATUS_LABELS[item.status] ?? item.status}
                </p>
                <p className="text-muted-foreground text-xs">{item.jobTitle}</p>
                <p className="text-muted-foreground/80 text-xs">
                  {formatDistanceToNow(new Date(item.occurredAt), {
                    addSuffix: true,
                  })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
