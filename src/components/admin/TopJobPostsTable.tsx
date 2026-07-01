import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";

import { ROUTES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TopJobPost } from "@/types";
import type { JobPostStatus } from "@/lib/constants";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const STATUS_VARIANT: Record<JobPostStatus, BadgeVariant> = {
  ACTIVE: "success",
  DRAFT: "secondary",
  CLOSED: "outline",
  FILLED: "brand",
};

/** Dashboard table of the job posts attracting the most applications. */
export function TopJobPostsTable({ jobs }: { jobs: TopJobPost[] }) {
  const t = useTranslations("admin.dashboard.topJobs");
  const tStatus = useTranslations("admin.dashboard.jobStatus");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="py-2 pr-4 font-medium">{t("colTitle")}</th>
                  <th className="px-4 py-2 text-right font-medium">
                    {t("colApplicants")}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    {t("colShortlisted")}
                  </th>
                  <th className="px-4 py-2 font-medium">{t("colDeadline")}</th>
                  <th className="py-2 pl-4 font-medium">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-muted/40 border-b transition-colors last:border-0"
                  >
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`${ROUTES.ADMIN}/jobs/${job.id}`}
                        className="hover:text-royal font-medium transition-colors"
                      >
                        {job.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {job.companyName}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {job.applicants.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {job.shortlisted.toLocaleString()}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                      {job.deadline
                        ? format(new Date(job.deadline), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="py-2.5 pl-4">
                      <Badge variant={STATUS_VARIANT[job.status]}>
                        {tStatus(job.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
