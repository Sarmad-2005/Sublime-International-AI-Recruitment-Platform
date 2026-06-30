import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarX2, CheckCircle2, SearchX } from "lucide-react";

import { interviewService } from "@/lib/services";
import { InterviewEntry } from "@/components/candidate/interview";

export const metadata: Metadata = {
  title: "AI Interview — SIORP",
  robots: { index: false, follow: false },
};

/**
 * AI-interview entry / device-check screen (SRS M5). Token-based — no auth
 * beyond the invite token. Branches on the token state: expired / completed /
 * unknown links get a friendly terminal message, an in-progress link resumes
 * the live session, and a valid link renders the device-check + consent flow.
 */
export default async function InterviewEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const entry = await interviewService.getInterviewEntry(token);

  if (!entry) {
    return (
      <InterviewMessage
        icon={<SearchX className="size-10 text-muted-foreground" />}
        title="Interview not found"
        body="This interview link is invalid. Please use the link from your invitation email, or contact Sublime International."
      />
    );
  }

  if (entry.state === "EXPIRED") {
    return (
      <InterviewMessage
        icon={<CalendarX2 className="size-10 text-amber-500" />}
        title="Interview link expired"
        body="This interview link has expired. Contact Sublime International to request a new invitation."
      />
    );
  }

  if (entry.state === "COMPLETED") {
    return (
      <InterviewMessage
        icon={<CheckCircle2 className="size-10 text-emerald-500" />}
        title="Interview already completed"
        body={`You've already completed your AI interview for ${entry.jobTitle}. Your results are with our recruitment team.`}
      />
    );
  }

  if (entry.state === "IN_PROGRESS") {
    redirect(`/interview/${token}/session`);
  }

  return <InterviewEntry entry={entry} />;
}

function InterviewMessage({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-muted/30 flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md space-y-3 text-center">
        <div className="flex justify-center">{icon}</div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
    </div>
  );
}
