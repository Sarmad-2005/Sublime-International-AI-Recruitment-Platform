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
import type { FeaturedJob } from "@/types";

function sectorLabel(sector: string): string {
  return JOB_SECTOR_LABELS[sector as JobSector] ?? sector;
}

function JobCard({ job }: { job: FeaturedJob }) {
  const t = useTranslations("candidate.dashboard");

  const salary =
    job.salaryMin !== null && job.salaryMax !== null
      ? t("salaryRange", {
          currency: job.salaryCurrency,
          min: job.salaryMin.toLocaleString(),
          max: job.salaryMax.toLocaleString(),
        })
      : t("salaryNegotiable");

  return (
    <Card className="gap-3">
      <CardHeader>
        <Badge variant="secondary" className="mb-1">
          {sectorLabel(job.sector)}
        </Badge>
        <CardTitle className="text-base leading-snug">{job.title}</CardTitle>
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
            {t("deadline", {
              date: format(new Date(job.deadline), "d MMM yyyy"),
            })}
          </p>
        )}
        <p className="text-foreground mt-1 font-semibold">{salary}</p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="brand" size="sm" className="w-full">
          <Link href={`${ROUTES.CANDIDATE}/jobs/${job.id}`}>
            {t("applyNow")}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Three featured active jobs the candidate hasn't applied to yet. */
export function FeaturedJobs({ jobs }: { jobs: FeaturedJob[] }) {
  const t = useTranslations("candidate.dashboard");

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("featuredHeading")}</h2>
          <p className="text-muted-foreground text-sm">{t("featuredSubtitle")}</p>
        </div>
        <Button asChild variant="link" size="sm" className="text-royal">
          <Link href={`${ROUTES.CANDIDATE}/jobs`}>{t("viewAllJobs")}</Link>
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {t("noFeatured")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </section>
  );
}
