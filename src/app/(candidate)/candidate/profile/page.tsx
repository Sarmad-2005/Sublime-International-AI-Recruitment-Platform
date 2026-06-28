import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ProfileTabs } from "@/components/candidate/ProfileTabs";

export const metadata: Metadata = {
  title: "My Profile — SIORP",
};

/**
 * Candidate profile page. The data fetch + section saves run client-side through
 * `useCandidateProfile` (TanStack Query) so each tab can save independently and
 * the completion meters update instantly; this server shell just sets the
 * heading and renders the tabbed editor.
 */
export default async function CandidateProfilePage() {
  const t = await getTranslations("candidate.profile");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </header>

      <ProfileTabs />
    </div>
  );
}
