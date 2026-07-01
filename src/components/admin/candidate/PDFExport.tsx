"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

import { Button } from "@/components/ui/button";
import { CANDIDATE_TIER_LABELS } from "@/lib/constants";
import type { CandidateTier } from "@/lib/constants";
import { exportCandidatesPDFAction } from "@/app/(admin)/admin/candidates/actions";

// ---------------------------------------------------------------------------
// PDF Document — rendered server-side via renderToBuffer in the action
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#111827",
  },
  watermark: {
    position: "absolute",
    top: "45%",
    left: "10%",
    fontSize: 42,
    color: "#e5e7eb",
    transform: "rotate(-35deg)",
    opacity: 0.4,
    fontFamily: "Helvetica-Bold",
  },
  header: {
    marginBottom: 24,
    borderBottom: "2 solid #1e3a5f",
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1e3a5f" },
  headerSub: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  candidateCard: {
    marginBottom: 18,
    border: "1 solid #e5e7eb",
    borderRadius: 4,
    padding: 14,
  },
  candidateName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  row: { flexDirection: "row", gap: 12, marginBottom: 6 },
  label: { fontSize: 9, color: "#6b7280", marginBottom: 2 },
  value: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  tierBadge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    color: "#1e3a5f",
    alignSelf: "flex-start",
  },
  summaryBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#9ca3af",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

type CandidatePDFData = {
  applicationId: string;
  candidateName: string;
  trade: string;
  yearsOfExperience: number;
  city: string | null;
  educationLevel: string;
  profilePhotoUrl: string | null;
  jobTitle: string;
  companyName: string;
  tier: CandidateTier;
  finalScore: number | null;
  assessmentScore: number | null;
  assessmentPassed: boolean | null;
  interviewScore: number | null;
  aiSummary: string | null;
};

export function CandidatePDFDocument({ candidates }: { candidates: CandidatePDFData[] }) {
  return (
    <Document
      title="Candidate Report — SIORP"
      author="Sublime International"
      subject="Candidate Presentation Report"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>SUBLIME INTERNATIONAL CONFIDENTIAL</Text>

        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Candidate Report</Text>
            <Text style={styles.headerSub}>Sublime International Overseas Recruitment Platform</Text>
          </View>
          <Text style={{ fontSize: 9, color: "#6b7280" }}>
            Generated: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </Text>
        </View>

        {candidates.map((c) => (
          <View key={c.applicationId} style={styles.candidateCard} wrap={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={styles.candidateName}>{c.candidateName}</Text>
              <Text style={styles.tierBadge}>{CANDIDATE_TIER_LABELS[c.tier]}</Text>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Trade / Role</Text>
                <Text style={styles.value}>{c.trade}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Experience</Text>
                <Text style={styles.value}>{c.yearsOfExperience} yr{c.yearsOfExperience !== 1 ? "s" : ""}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>City</Text>
                <Text style={styles.value}>{c.city ?? "—"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Education</Text>
                <Text style={styles.value}>{c.educationLevel}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Applied For</Text>
                <Text style={styles.value}>{c.jobTitle}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Client</Text>
                <Text style={styles.value}>{c.companyName}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Assessment</Text>
                <Text style={styles.value}>
                  {c.assessmentScore != null ? `${c.assessmentScore.toFixed(1)}%` : "—"}
                  {c.assessmentPassed != null ? (c.assessmentPassed ? " ✓" : " ✗") : ""}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Interview Score</Text>
                <Text style={styles.value}>
                  {c.interviewScore != null ? `${c.interviewScore.toFixed(1)}%` : "—"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Final Score</Text>
                <Text style={styles.value}>
                  {c.finalScore != null ? `${c.finalScore.toFixed(1)}%` : "—"}
                </Text>
              </View>
            </View>

            {c.aiSummary && (
              <View style={styles.summaryBox}>
                <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3, fontSize: 9 }}>
                  AI Interview Summary
                </Text>
                <Text>{c.aiSummary}</Text>
              </View>
            )}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>CONFIDENTIAL — Sublime International</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Client-side export button
// ---------------------------------------------------------------------------

interface PDFExportProps {
  applicationIds: string[];
  disabled?: boolean;
}

export function PDFExportButton({ applicationIds, disabled }: PDFExportProps) {
  const t = useTranslations("admin.candidates.pdf");
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    if (applicationIds.length === 0) {
      toast.error(t("selectAtLeast"));
      return;
    }
    startTransition(async () => {
      const result = await exportCandidatesPDFAction(applicationIds);
      if (!result.ok) {
        toast.error(result.error ?? t("exportFailed"));
        return;
      }
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `siorp-candidates-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("exportedToast", { count: applicationIds.length }));
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={disabled || isPending || applicationIds.length === 0}
    >
      <FileDown className="size-4" />
      {isPending ? t("generating") : t("export")}
    </Button>
  );
}
