import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Heart,
  MessageSquare,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import { authService, clientPortalService } from "@/lib/services";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard — Sublime International",
};

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Saudi Client dashboard (Server Component). */
export default async function ClientDashboardPage() {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== USER_ROLES.SAUDI_CLIENT) {
    redirect(ROUTES.LOGIN);
  }

  const data = await clientPortalService.getClientDashboard(user.id);
  const { summary } = data;

  const stats = [
    {
      label: "Total in Pool",
      value: summary.total,
      icon: Users,
      color: "royal" as const,
    },
    {
      label: "Interested",
      value: summary.interested,
      icon: Heart,
      color: "gold" as const,
    },
    {
      label: "Shortlisted",
      value: summary.shortlisted,
      icon: Star,
      color: "navy" as const,
    },
    {
      label: "Selected",
      value: summary.selected,
      icon: CheckCircle2,
      color: "emerald" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting(new Date())}, {data.contactName || "there"}
            <span className="text-muted-foreground font-normal">
              {" "}
              | {data.companyName}
            </span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Here&apos;s an overview of your talent pool with Sublime International.
          </p>
        </div>
        {data.newSinceLastLogin > 0 && (
          <Link href={`${ROUTES.CLIENT}/pool`}>
            <span className="bg-gold/15 text-gold-dark ring-gold/30 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset">
              <Sparkles className="size-4" />
              {data.newSinceLastLogin} new candidate
              {data.newSinceLastLogin === 1 ? "" : "s"} added
            </span>
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming interviews */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="text-navy size-5" />
              Upcoming Live Interviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingInterviews.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No live interviews are scheduled yet. Shortlist candidates to
                request one.
              </p>
            ) : (
              <ul className="divide-y">
                {data.upcomingInterviews.map((iv) => (
                  <li
                    key={iv.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{iv.candidateName}</p>
                      <p className="text-muted-foreground truncate text-sm">
                        {iv.jobTitle}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {format(new Date(iv.scheduledAt), "d MMM yyyy")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(iv.scheduledAt), "h:mm a")} ·{" "}
                        {iv.durationMinutes} min
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Latest message */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="text-navy size-5" />
              Latest Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.latestMessage ? (
              <>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    {data.latestMessage.fromAdmin
                      ? "Sublime International team"
                      : "You"}{" "}
                    · {format(new Date(data.latestMessage.sentAt), "d MMM, h:mm a")}
                  </p>
                  <p className="line-clamp-4 text-sm">
                    {data.latestMessage.content}
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`${ROUTES.CLIENT}/messages`}>
                    Open messages
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No messages yet. Our team typically replies within 24 hours.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const ICON_COLORS = {
  royal: "bg-royal/10 text-royal",
  gold: "bg-gold/10 text-gold",
  navy: "bg-navy/10 text-navy",
  emerald: "bg-emerald-500/10 text-emerald-600",
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: keyof typeof ICON_COLORS;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-lg",
            ICON_COLORS[color],
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-muted-foreground truncate text-sm">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
