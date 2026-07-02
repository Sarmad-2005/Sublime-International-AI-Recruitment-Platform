import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TierBadge } from "@/components/client/TierBadge";
import { ScoreBar } from "@/components/client/ScoreBar";
import { CandidateActions } from "@/components/client/CandidateActions";
import type { ClientPoolCandidate } from "@/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)
  ).toUpperCase();
}

/** One candidate card in the client's Talent Pool grid. */
export function CandidateCard({ candidate }: { candidate: ClientPoolCandidate }) {
  const href = `${ROUTES.CLIENT}/pool/${candidate.applicationId}`;

  return (
    <Card className="gap-4 py-5">
      <CardContent className="flex flex-col gap-4">
        {/* Header: avatar + name + tier */}
        <div className="flex items-start gap-3">
          <Avatar className="size-14 border">
            {candidate.profilePhotoUrl && (
              <AvatarImage
                src={candidate.profilePhotoUrl}
                alt={candidate.fullName}
              />
            )}
            <AvatarFallback className="bg-navy/10 text-navy font-semibold">
              {initials(candidate.fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <Link href={href} className="hover:underline">
              <h3 className="truncate font-semibold">{candidate.fullName}</h3>
            </Link>
            <div className="mt-1">
              <TierBadge tier={candidate.tier} />
            </div>
          </div>

          <div className="text-right">
            <p className="text-navy text-3xl leading-none font-bold tabular-nums">
              {candidate.finalScore == null
                ? "—"
                : Math.round(candidate.finalScore)}
            </p>
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
              Final Score
            </p>
          </div>
        </div>

        {/* Trade + experience */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Briefcase className="size-4 shrink-0" />
          <span className="truncate">
            {candidate.primaryTrade} · {candidate.yearsOfExperience} yr
            {candidate.yearsOfExperience === 1 ? "" : "s"} experience
          </span>
        </div>

        {/* Score bars */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreBar
            label="Assessment"
            value={candidate.assessmentScore}
            color="gold"
          />
          <ScoreBar
            label="Interview"
            value={candidate.interviewScore}
            color="royal"
          />
        </div>

        {/* Interest controls */}
        <CandidateActions
          applicationId={candidate.applicationId}
          status={candidate.clientStatus}
        />

        {/* View profile */}
        <Button asChild variant="ghost" className="text-royal justify-between">
          <Link href={href}>
            View Full Profile
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
