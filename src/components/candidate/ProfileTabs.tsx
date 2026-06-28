"use client";

import { useTranslations } from "next-intl";

import { useCandidateProfile } from "@/hooks/useCandidate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonalInfoForm } from "@/components/candidate/PersonalInfoForm";
import { DocumentsForm } from "@/components/candidate/DocumentsForm";
import { EducationSkillsForm } from "@/components/candidate/EducationSkillsForm";

/** Small "NN%" pill shown on each tab trigger. */
function CompletionPill({ percentage }: { percentage: number }) {
  return (
    <Badge
      variant={percentage === 100 ? "success" : "secondary"}
      className="ml-1.5 hidden text-[10px] sm:inline-flex"
    >
      {percentage}%
    </Badge>
  );
}

/**
 * Tabbed candidate profile editor (client). Reads the profile + completion from
 * `useCandidateProfile` and renders the three independently-saving sections.
 */
export function ProfileTabs() {
  const t = useTranslations("candidate.profile");
  const { profile, completion, isLoading, updateProfile, isUpdating } =
    useCandidateProfile();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const sections = completion?.sections;
  const profileExists = profile !== null;

  return (
    <div className="space-y-4">
      {/* Overall completion */}
      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{t("title")}</span>
              <span className="text-muted-foreground tabular-nums">
                {t("overallComplete", { percent: completion?.overall ?? 0 })}
              </span>
            </div>
            <Progress
              value={completion?.overall ?? 0}
              indicatorClassName="bg-royal"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="personal">
            {t("tabs.personal")}
            {sections && <CompletionPill percentage={sections.personal.percentage} />}
          </TabsTrigger>
          <TabsTrigger value="documents">
            {t("tabs.documents")}
            {sections && (
              <CompletionPill percentage={sections.documents.percentage} />
            )}
          </TabsTrigger>
          <TabsTrigger value="education">
            {t("tabs.education")}
            {sections && (
              <CompletionPill percentage={sections.education.percentage} />
            )}
          </TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardContent>
            <TabsContent value="personal" className="mt-0">
              <PersonalInfoForm
                profile={profile}
                onSave={updateProfile}
                isSaving={isUpdating}
              />
            </TabsContent>
            <TabsContent value="documents" className="mt-0">
              <DocumentsForm
                profile={profile}
                onSave={updateProfile}
                profileExists={profileExists}
              />
            </TabsContent>
            <TabsContent value="education" className="mt-0">
              {!profileExists && (
                <p className="bg-amber-50 text-amber-800 mb-4 rounded-md border border-amber-200 px-3 py-2 text-sm">
                  {t("createFirstNotice")}
                </p>
              )}
              <EducationSkillsForm
                profile={profile}
                onSave={updateProfile}
                isSaving={isUpdating}
              />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
