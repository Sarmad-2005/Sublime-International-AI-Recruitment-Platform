"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Eye,
  Save,
  FileText,
  Briefcase,
  DollarSign,
  ClipboardList,
  BarChart3,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  JOB_SECTOR_LABELS,
  JOB_SECTOR_VALUES,
  JOB_BENEFIT_LABELS,
  JOB_BENEFIT_VALUES,
  ROUTES,
  type JobBenefit,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "./RichTextEditor";
import { TierThresholdEditor } from "./TierThresholdEditor";
import { JobCard } from "./JobCard";
import type { AdminJobFormData, LinkedAssessmentInfo, LinkedInterviewSetInfo } from "@/types";
import { createJobPostAction, updateJobPostAction } from "@/app/(admin)/admin/jobs/actions";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const schema = z
  .object({
    title: z.string().min(2, "Title must be at least 2 characters").max(200),
    sector: z.string().min(1, "Sector is required"),
    country: z.string().min(1, "Country is required"),
    city: z.string().max(100).optional().default(""),
    clientId: z.string().min(1, "Client is required"),
    vacancies: z.coerce.number().int().min(1, "At least 1 vacancy").max(9999),
    status: z.enum(["DRAFT", "ACTIVE"]),

    description: z.string().optional().default(""),
    requiredQualifications: z.string().optional().default(""),
    contractDurationMonths: z.coerce
      .number()
      .int()
      .min(1)
      .max(120)
      .nullable()
      .optional(),
    applicationDeadline: z.string().nullable().optional(),

    salaryMin: z.coerce.number().int().min(0).nullable().optional(),
    salaryMax: z.coerce.number().int().min(0).nullable().optional(),
    benefits: z.array(z.string()).default([]),

    assessmentWeight: z.coerce.number().min(0).max(100).default(35),
    interviewWeight: z.coerce.number().min(0).max(100).default(65),
    tierThresholds: z
      .object({
        diamondMin: z.coerce.number().int().min(0).max(100),
        platinumMin: z.coerce.number().int().min(0).max(100),
        goldMin: z.coerce.number().int().min(0).max(100),
        bronzeMin: z.coerce.number().int().min(0).max(100),
      })
      .nullable()
      .optional(),
  })
  .refine(
    (d) => {
      const sum = (d.assessmentWeight ?? 35) + (d.interviewWeight ?? 65);
      return Math.abs(sum - 100) < 0.01;
    },
    {
      message: "Assessment weight + Interview weight must equal 100%",
      path: ["assessmentWeight"],
    },
  );

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Section nav
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: "basic", label: "Basic Info", icon: Briefcase },
  { id: "details", label: "Job Details", icon: FileText },
  { id: "compensation", label: "Compensation", icon: DollarSign },
  { id: "assessment", label: "Assessment", icon: ClipboardList },
  { id: "tiers", label: "Tier Thresholds", icon: BarChart3 },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface JobFormProps {
  mode: "create" | "edit";
  jobId?: string;
  initialData?: Partial<AdminJobFormData>;
  clients: Array<{ id: string; companyName: string; city: string }>;
  assessment?: LinkedAssessmentInfo | null;
  interviewSet?: LinkedInterviewSetInfo | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JobForm({
  mode,
  jobId,
  initialData,
  clients,
  assessment,
  interviewSet,
}: JobFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("basic");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultValues: FormValues = {
    title: initialData?.title ?? "",
    sector: initialData?.sector ?? "",
    country: initialData?.country ?? "Saudi Arabia",
    city: initialData?.city ?? "",
    clientId: initialData?.clientId ?? "",
    vacancies: initialData?.vacancies ?? 1,
    status: initialData?.status ?? "DRAFT",
    description: initialData?.description ?? "",
    requiredQualifications: initialData?.requiredQualifications ?? "",
    contractDurationMonths: initialData?.contractDurationMonths ?? null,
    applicationDeadline: initialData?.applicationDeadline ?? null,
    salaryMin: initialData?.salaryMin ?? null,
    salaryMax: initialData?.salaryMax ?? null,
    benefits: initialData?.benefits ?? [],
    assessmentWeight: initialData?.assessmentWeight ?? 35,
    interviewWeight: initialData?.interviewWeight ?? 65,
    tierThresholds: initialData?.tierThresholds ?? {
      diamondMin: 90,
      platinumMin: 75,
      goldMin: 60,
      bronzeMin: 45,
    },
  };

  const form = useForm<FormValues>({
    // Cast needed: z.coerce.* infers input as `unknown` in Zod v4, but at
    // runtime react-hook-form passes the right values through.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues,
  });

  const { register, control, handleSubmit, watch, formState } = form;
  const watchedValues = watch();

  // ---------------------------------------------------------------------------
  // Autosave (edit mode only)
  // ---------------------------------------------------------------------------

  const autosave = useCallback(async () => {
    if (mode !== "edit" || !jobId || !formState.isDirty) return;
    const values = form.getValues();
    const parsed = schema.safeParse(values);
    if (!parsed.success) return;
    const result = await updateJobPostAction(jobId, parsed.data as AdminJobFormData);
    if (result.ok) {
      toast.success("Draft saved", { duration: 1500, id: "autosave" });
    }
  }, [mode, jobId, formState.isDirty, form]);

  useEffect(() => {
    if (mode !== "edit") return;
    const sub = form.watch(() => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(autosave, 30_000);
    });
    return () => {
      sub.unsubscribe();
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [mode, autosave, form]);

  // ---------------------------------------------------------------------------
  // Section intersection observer
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const sectionEls = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const top = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
          );
          setActiveSection((top.target as HTMLElement).id as SectionId);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    sectionEls.forEach((el) => observer.observe(el!));
    return () => observer.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      if (mode === "create") {
        const result = await createJobPostAction(values as AdminJobFormData);
        if (result.ok) {
          toast.success("Job post created");
          router.push(`${ROUTES.ADMIN}/jobs/${result.data.id}`);
        } else {
          toast.error(result.error);
        }
      } else if (jobId) {
        const result = await updateJobPostAction(jobId, values as AdminJobFormData);
        if (result.ok) {
          toast.success("Job post saved");
          router.push(`${ROUTES.ADMIN}/jobs/${jobId}`);
        } else {
          toast.error(result.error);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const previewData: Partial<AdminJobFormData> = {
    ...watchedValues,
    salaryMin: watchedValues.salaryMin ?? null,
    salaryMax: watchedValues.salaryMax ?? null,
    applicationDeadline: watchedValues.applicationDeadline ?? null,
    tierThresholds: watchedValues.tierThresholds ?? null,
  };

  const selectedClient = clients.find((c) => c.id === watchedValues.clientId);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <form onSubmit={handleSubmit(onSubmit as any)}>
      <div className="flex gap-8">
        {/* ---- Sticky sidebar nav ---- */}
        <aside className="hidden w-44 shrink-0 lg:block">
          <div className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-left",
                    activeSection === s.id
                      ? "bg-royal/10 text-royal font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {s.label}
                </button>
              );
            })}

            <div className="border-t pt-3 space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="size-4" />
                Preview
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-royal hover:bg-royal/90 w-full justify-start gap-2 text-white"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {mode === "create" ? "Create Job" : "Save Changes"}
              </Button>
            </div>
          </div>
        </aside>

        {/* ---- Main scrollable form ---- */}
        <div className="min-w-0 flex-1 space-y-10">

          {/* Global errors */}
          {Object.keys(formState.errors).length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>Please fix the errors below before saving.</span>
            </div>
          )}

          {/* ===== SECTION 1: Basic Info ===== */}
          <section id="basic" className="scroll-mt-24">
            <SectionHeading icon={Briefcase} title="Basic Info" step={1} />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel label="Job Title" required />
                <Input
                  {...register("title")}
                  placeholder="e.g. Electrician — Saudi Arabia"
                  className={cn(formState.errors.title && "border-red-400")}
                />
                <FieldError msg={formState.errors.title?.message} />
              </div>

              <div>
                <FieldLabel label="Sector" required />
                <Controller
                  name="sector"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={cn(formState.errors.sector && "border-red-400")}>
                        <SelectValue placeholder="Select sector…" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_SECTOR_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {JOB_SECTOR_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={formState.errors.sector?.message} />
              </div>

              <div>
                <FieldLabel label="Saudi Client" required />
                <Controller
                  name="clientId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={cn(formState.errors.clientId && "border-red-400")}>
                        <SelectValue placeholder="Search client…" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.companyName}
                            <span className="text-muted-foreground ml-1 text-xs">— {c.city}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={formState.errors.clientId?.message} />
              </div>

              <div>
                <FieldLabel label="Country" required />
                <Input
                  {...register("country")}
                  placeholder="Saudi Arabia"
                />
              </div>

              <div>
                <FieldLabel label="City" />
                <Input {...register("city")} placeholder="e.g. Riyadh" />
              </div>

              <div>
                <FieldLabel label="Number of Vacancies" required />
                <Input
                  type="number"
                  min={1}
                  {...register("vacancies")}
                  className={cn(formState.errors.vacancies && "border-red-400")}
                />
                <FieldError msg={formState.errors.vacancies?.message} />
              </div>

              <div>
                <FieldLabel label="Status" required />
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </section>

          {/* ===== SECTION 2: Job Details ===== */}
          <section id="details" className="scroll-mt-24">
            <SectionHeading icon={FileText} title="Job Details" step={2} />
            <div className="space-y-5">
              <div>
                <FieldLabel label="Job Description" />
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Describe the role, responsibilities, and expectations…"
                      className="mt-1"
                    />
                  )}
                />
              </div>

              <div>
                <FieldLabel label="Required Qualifications" />
                <Controller
                  name="requiredQualifications"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="List the required skills, certifications, and experience…"
                      className="mt-1"
                    />
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Contract Duration (months)" />
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    placeholder="e.g. 24"
                    {...register("contractDurationMonths")}
                  />
                </div>
                <div>
                  <FieldLabel label="Application Deadline" />
                  <Input
                    type="date"
                    {...register("applicationDeadline")}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ===== SECTION 3: Compensation & Benefits ===== */}
          <section id="compensation" className="scroll-mt-24">
            <SectionHeading icon={DollarSign} title="Compensation & Benefits" step={3} />
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Salary Min (SAR/month)" />
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 2000"
                    {...register("salaryMin")}
                  />
                </div>
                <div>
                  <FieldLabel label="Salary Max (SAR/month)" />
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 4000"
                    {...register("salaryMax")}
                  />
                </div>
              </div>

              <div>
                <FieldLabel label="Benefits" />
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Controller
                    name="benefits"
                    control={control}
                    render={({ field }) => (
                      <>
                        {JOB_BENEFIT_VALUES.map((benefit) => (
                          <label
                            key={benefit}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                          >
                            <Checkbox
                              checked={field.value.includes(benefit)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, benefit]);
                                } else {
                                  field.onChange(field.value.filter((b) => b !== benefit));
                                }
                              }}
                            />
                            {JOB_BENEFIT_LABELS[benefit as JobBenefit]}
                          </label>
                        ))}
                      </>
                    )}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ===== SECTION 4: Assessment Configuration ===== */}
          <section id="assessment" className="scroll-mt-24">
            <SectionHeading icon={ClipboardList} title="Assessment Configuration" step={4} />
            <div className="space-y-4">
              {/* Trade Assessment */}
              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Trade Assessment</p>
                    {assessment ? (
                      <div className="mt-1 space-y-0.5 text-sm">
                        <p className="text-muted-foreground">{assessment.title}</p>
                        <div className="flex gap-3 text-xs">
                          <span className="text-muted-foreground">
                            {assessment.totalQuestions} questions
                          </span>
                          <span className="text-muted-foreground">
                            {assessment.timeLimitMinutes} min limit
                          </span>
                          <span className="font-medium text-amber-600">
                            Pass threshold: {assessment.passingScore}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-1 text-sm">
                        No assessment linked yet.
                      </p>
                    )}
                  </div>
                  {jobId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() =>
                        router.push(`${ROUTES.ADMIN}/jobs/${jobId}/assessment`)
                      }
                    >
                      <ExternalLink className="size-3.5" />
                      {assessment ? "Configure" : "Create Assessment"}
                    </Button>
                  )}
                </div>
              </div>

              {/* AI Interview Set */}
              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">AI Interview Set</p>
                    {interviewSet ? (
                      <div className="mt-1 space-y-0.5 text-sm">
                        <p className="text-muted-foreground">{interviewSet.title}</p>
                        <div className="flex gap-3 text-xs">
                          <span className="text-muted-foreground">
                            {interviewSet.questionCount} questions
                          </span>
                          <span className="text-muted-foreground">
                            {interviewSet.maxDurationMinutes} min max
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-1 text-sm">
                        No interview set linked yet.
                      </p>
                    )}
                  </div>
                  {jobId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() =>
                        router.push(`${ROUTES.ADMIN}/jobs/${jobId}/interview-set`)
                      }
                    >
                      <ExternalLink className="size-3.5" />
                      {interviewSet ? "Configure" : "Create Interview Set"}
                    </Button>
                  )}
                </div>
              </div>

              {mode === "create" && (
                <p className="text-muted-foreground text-sm">
                  Save this job first to link an assessment or interview set.
                </p>
              )}
            </div>
          </section>

          {/* ===== SECTION 5: Tier Thresholds ===== */}
          <section id="tiers" className="scroll-mt-24">
            <SectionHeading icon={BarChart3} title="Tier Thresholds" step={5} />
            <Controller
              name="tierThresholds"
              control={control}
              render={({ field: threshField }) => (
                <Controller
                  name="assessmentWeight"
                  control={control}
                  render={({ field: awField }) => (
                    <Controller
                      name="interviewWeight"
                      control={control}
                      render={({ field: iwField }) => (
                        <TierThresholdEditor
                          thresholds={
                            threshField.value ?? {
                              diamondMin: 90,
                              platinumMin: 75,
                              goldMin: 60,
                              bronzeMin: 45,
                            }
                          }
                          onThresholdsChange={threshField.onChange}
                          assessmentWeight={awField.value}
                          interviewWeight={iwField.value}
                          onAssessmentWeightChange={awField.onChange}
                          onInterviewWeightChange={iwField.onChange}
                        />
                      )}
                    />
                  )}
                />
              )}
            />
            {formState.errors.assessmentWeight && (
              <FieldError msg={formState.errors.assessmentWeight.message} />
            )}
          </section>

          {/* Mobile submit row */}
          <div className="flex gap-3 border-t pt-6 lg:hidden">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="size-4" />
              Preview
            </Button>
            <Button
              type="submit"
              className="bg-royal hover:bg-royal/90 flex-1 gap-2 text-white"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {mode === "create" ? "Create Job" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Candidate Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <JobCard
              data={previewData}
              companyName={selectedClient?.companyName ?? ""}
            />
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function SectionHeading({
  icon: Icon,
  title,
  step,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  step: number;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="bg-royal/10 text-royal grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold">
        {step}
      </span>
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground size-4" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Label className="mb-1 block text-sm">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </Label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle className="size-3" />
      {msg}
    </p>
  );
}
