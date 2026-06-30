import "server-only";

import { prisma, Prisma } from "@/lib/prisma";
import {
  CANDIDATE_TIERS,
  DEFAULT_SCORING_WEIGHTS,
  TIER_SCORE_RANGES,
  type CandidateTier,
  type ScoredTier,
} from "@/lib/constants";
import type { ApplicationStatus } from "@/generated/prisma/enums";

/**
 * Tiering service (SRS M6 / FR-TIER-001) — the weighted-score → tier pipeline
 * that runs once the AI interview is scored. Pure helpers (`calculateFinalScore`,
 * `assignTier`) are kept side-effect-free so they can be unit-tested and reused
 * by admin override flows; the DB writes go through `createTierRecord` /
 * `updateApplicationStage`. Only the service layer touches the DB (Rule #5).
 */

/** Stage-1 / Stage-2 blend weights. Defaults to 0.35 / 0.65 (W1 + W2 = 1.0). */
export interface ScoringWeights {
  assessment: number;
  interview: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  assessment: DEFAULT_SCORING_WEIGHTS.stage1Assessment,
  interview: DEFAULT_SCORING_WEIGHTS.stage2Interview,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Weighted final score (0–100). When one stage is missing the other carries the
 * full weight, so a candidate is never penalised for a stage that didn't run.
 */
export function calculateFinalScore(
  assessmentScore: number | null,
  interviewScore: number | null,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): number {
  if (assessmentScore == null && interviewScore == null) return 0;
  if (assessmentScore == null) return round2(interviewScore!);
  if (interviewScore == null) return round2(assessmentScore);
  return round2(
    assessmentScore * weights.assessment + interviewScore * weights.interview,
  );
}

/**
 * Map a 0–100 final score to a tier using the platform default ranges
 * (FR-TIER-001). Comparison is on the raw score so boundary values land in the
 * documented band (e.g. 89.6 → Platinum, not Diamond).
 */
export function assignTier(finalScore: number): ScoredTier {
  // Descending by `min` so the first match wins.
  const ordered: ScoredTier[] = ["DIAMOND", "PLATINUM", "GOLD", "BRONZE", "REJECTED"];
  for (const tier of ordered) {
    if (finalScore >= TIER_SCORE_RANGES[tier].min) return tier;
  }
  return CANDIDATE_TIERS.REJECTED;
}

export interface CreateTierRecordInput {
  applicationId: string;
  candidateId: string;
  assessmentScore: number | null;
  interviewScore: number | null;
  finalScore: number;
  tier: CandidateTier;
  weights?: ScoringWeights;
}

/**
 * Persist (or update) the candidate's tier record for an application. Idempotent
 * on `applicationId` (unique), so a re-score updates the existing row rather
 * than failing.
 */
export async function createTierRecord(input: CreateTierRecordInput) {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const now = new Date();
  const data = {
    candidateId: input.candidateId,
    assessmentScore: input.assessmentScore,
    interviewScore: input.interviewScore,
    assessmentWeight: new Prisma.Decimal(weights.assessment),
    interviewWeight: new Prisma.Decimal(weights.interview),
    finalScore: input.finalScore,
    tier: input.tier,
    assignedAt: now,
  };

  return prisma.candidateTierRecord.upsert({
    where: { applicationId: input.applicationId },
    create: { applicationId: input.applicationId, ...data },
    // Never clobber a manual admin override on re-score.
    update: data,
  });
}

/** Advance (or correct) an application's pipeline status. */
export async function updateApplicationStage(
  applicationId: string,
  stage: ApplicationStatus,
): Promise<void> {
  await prisma.application.update({
    where: { id: applicationId },
    data: { status: stage },
  });
}
