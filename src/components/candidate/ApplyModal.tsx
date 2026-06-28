"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Mail,
  Smartphone,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { useCreateApplication } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CVUpload } from "@/components/candidate/CVUpload";

export interface ApplyModalContact {
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
}

interface ApplyModalProps {
  job: { id: string; title: string };
  /** Overall profile completion (0–100). Below 80 blocks applying. */
  profileComplete: number;
  initialCvUrl: string | null;
  cvUploadedAt: string | null;
  contact: ApplyModalContact;
  /** Label for the trigger button (e.g. "Apply Now"). */
  triggerLabel: string;
  /** Trigger appearance. */
  triggerClassName?: string;
}

const MIN_PROFILE_COMPLETION = 80;
const TOTAL_STEPS = 3;

/** Small verified/not-verified status row used in the contact step. */
function StatusRow({
  icon,
  label,
  value,
  verified,
  verifiedLabel,
  unverifiedLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  verified: boolean;
  verifiedLabel: string;
  unverifiedLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-md">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{value || label}</p>
        <p
          className={cn(
            "flex items-center gap-1 text-xs",
            verified ? "text-emerald-600" : "text-amber-600",
          )}
        >
          {verified ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <XCircle className="size-3.5" />
          )}
          {verified ? verifiedLabel : unverifiedLabel}
        </p>
      </div>
    </div>
  );
}

/**
 * Application flow modal (Client Component). Three steps — confirm CV, verify
 * contact details, acknowledge & submit — then a success state pointing at the
 * next step (the trade assessment). If the profile is under 80% complete the
 * modal shows a "complete your profile first" guard instead of the steps.
 */
export function ApplyModal({
  job,
  profileComplete,
  initialCvUrl,
  cvUploadedAt,
  contact,
  triggerLabel,
  triggerClassName,
}: ApplyModalProps) {
  const t = useTranslations("candidate.apply");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [cvUrl, setCvUrl] = useState<string | null>(initialCvUrl);
  const [acknowledged, setAcknowledged] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const { createApplication, isSubmitting, error, reset } = useCreateApplication();

  const profileReady = profileComplete >= MIN_PROFILE_COMPLETION;
  // Phase 1: only email verification gates applying. Mobile (OTP) verification
  // isn't wired up yet, so an unverified mobile is shown but doesn't block.
  const contactVerified = contact.emailVerified;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset for next time; refresh the page if an application was just created.
      const created = createdId !== null;
      setStep(1);
      setAcknowledged(false);
      setCreatedId(null);
      setCvUrl(initialCvUrl);
      reset();
      if (created) router.refresh();
    }
  }

  async function handleSubmit() {
    if (!cvUrl) return;
    try {
      const application = await createApplication({
        jobPostId: job.id,
        cvUrl,
        acknowledged: true,
      });
      setCreatedId(application.id);
    } catch {
      // Error surfaced via `error` from the mutation.
    }
  }

  const applicationHref = createdId
    ? `${ROUTES.CANDIDATE}/applications/${createdId}`
    : ROUTES.CANDIDATE;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="brand" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {createdId ? (
          // ---------------------------------------------------------------- success
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>
            <DialogHeader className="items-center">
              <DialogTitle>{t("successTitle")}</DialogTitle>
              <DialogDescription>
                {t("successBody", { job: job.title })}
              </DialogDescription>
            </DialogHeader>
            <div className="bg-royal/5 text-royal flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium">
              <ClipboardCheck className="size-4" />
              {t("successNext")}
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button asChild variant="brand" className="flex-1">
                <Link href={applicationHref}>{t("takeAssessment")}</Link>
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
              >
                {t("done")}
              </Button>
            </div>
          </div>
        ) : !profileReady ? (
          // ---------------------------------------------------------- profile guard
          <>
            <DialogHeader>
              <DialogTitle>{t("incompleteTitle")}</DialogTitle>
              <DialogDescription>
                {t("incompleteBody", { percent: profileComplete })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button asChild variant="brand">
                <Link href={`${ROUTES.CANDIDATE}/profile`}>
                  {t("completeProfile")}
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          // ------------------------------------------------------------------- steps
          <>
            <DialogHeader>
              <DialogTitle>{t("title", { job: job.title })}</DialogTitle>
              <DialogDescription>
                {t("stepLabel", { current: step, total: TOTAL_STEPS })}
              </DialogDescription>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    i + 1 <= step ? "bg-royal" : "bg-muted",
                  )}
                />
              ))}
            </div>

            <div className="min-h-[180px] space-y-3 py-1">
              {step === 1 && (
                <>
                  <h3 className="text-sm font-semibold">{t("stepCv")}</h3>
                  <p className="text-muted-foreground text-sm">{t("cvIntro")}</p>
                  <CVUpload
                    value={cvUrl}
                    uploadedAt={cvUploadedAt}
                    onChange={setCvUrl}
                  />
                  {!cvUrl && (
                    <p className="text-amber-600 text-xs">{t("cvMissing")}</p>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <h3 className="text-sm font-semibold">{t("stepVerify")}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t("verifyIntro")}
                  </p>
                  <div className="space-y-2">
                    <StatusRow
                      icon={<Mail className="size-4" />}
                      label="Email"
                      value={contact.email}
                      verified={contact.emailVerified}
                      verifiedLabel={t("emailVerified")}
                      unverifiedLabel={t("emailUnverified")}
                    />
                    <StatusRow
                      icon={<Smartphone className="size-4" />}
                      label="Mobile"
                      value={contact.phone ?? ""}
                      verified={contact.phoneVerified}
                      verifiedLabel={t("phoneVerified")}
                      unverifiedLabel={t("phoneUnverified")}
                    />
                  </div>
                  {!contactVerified && (
                    <p className="text-muted-foreground text-xs">
                      {t("verifyHint")}
                    </p>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <h3 className="text-sm font-semibold">{t("stepConfirm")}</h3>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                    <Checkbox
                      checked={acknowledged}
                      onCheckedChange={(v) => setAcknowledged(v === true)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">{t("acknowledge")}</span>
                  </label>
                  {error && (
                    <p className="text-destructive text-sm">
                      {error.code === "ALREADY_APPLIED"
                        ? t("alreadyAppliedError")
                        : error.message}
                    </p>
                  )}
                </>
              )}
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                variant="ghost"
                onClick={() =>
                  step === 1 ? handleOpenChange(false) : setStep((s) => s - 1)
                }
                disabled={isSubmitting}
              >
                {step === 1 ? t("cancel") : t("back")}
              </Button>

              {step < TOTAL_STEPS ? (
                <Button
                  variant="brand"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={
                    (step === 1 && !cvUrl) || (step === 2 && !contactVerified)
                  }
                >
                  {t("next")}
                </Button>
              ) : (
                <Button
                  variant="brand"
                  onClick={handleSubmit}
                  disabled={!acknowledged || isSubmitting}
                >
                  {isSubmitting && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {isSubmitting ? t("submitting") : t("submit")}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
