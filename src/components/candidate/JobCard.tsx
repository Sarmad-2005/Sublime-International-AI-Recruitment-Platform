import Link from "next/link";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Building2, CalendarClock, MapPin, Users } from "lucide-react";

import { ROUTES, JOB_SECTOR_LABELS, type JobSector } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobBoardItem } from "@/types";

function sectorLabel(sector: string): string {
  return JOB_SECTOR_LABELS[sector as JobSector] ?? sector;
}

/**
 * A single job card on the Job Board grid. Isomorphic (next-intl `useTranslations`
 * works in both Server and Client Components), so it renders the same whether the
 * grid is server-rendered or driven client-side by React Query.
 */
export function JobCard({ job }: { job: JobBoardItem }) {
  const t = useTranslations("candidate.jobs");

  const salary =
    job.salaryMin !== null && job.salaryMax !== null
      ? t("salaryRange", {
          currency: job.salaryCurrency,
          min: job.salaryMin.toLocaleString(),
          max: job.salaryMax.toLocaleString(),
        })
      : t("salaryNegotiable");

  const href = `${ROUTES.CANDIDATE}/jobs/${job.id}`;

  return (
    <Card className="gap-3">
      <CardHeader>
        <Badge variant="secondary" className="mb-1">
          {sectorLabel(job.sector)}
        </Badge>
        <CardTitle className="text-base leading-snug">
          <Link href={href} className="hover:text-royal transition-colors">
            {job.title}
          </Link>
        </CardTitle>
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Building2 className="size-3.5" />
          {job.companyName}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-xs">
        <p className="flex items-center gap-1.5">
          <MapPin className="text-muted-foreground size-3.5" />
          {[job.city, job.country].filter(Boolean).join(", ")}
        </p>
        <p className="flex items-center gap-1.5">
          <Users className="text-muted-foreground size-3.5" />
          {t("vacancies", { count: job.vacancies })}
        </p>
        {job.deadline && (
          <p className="flex items-center gap-1.5">
            <CalendarClock className="text-muted-foreground size-3.5" />
            {t("deadline", { date: format(new Date(job.deadline), "d MMM yyyy") })}
          </p>
        )}
        <p className="text-foreground mt-1 font-semibold">{salary}</p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="brand" size="sm" className="w-full">
          <Link href={href}>{t("applyNow")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
