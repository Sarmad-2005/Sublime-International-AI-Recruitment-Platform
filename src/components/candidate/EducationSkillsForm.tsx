"use client";

import { z } from "zod";
import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  educationSkillsSchema,
  type UpdateCandidateProfileInput,
} from "@/lib/validations";
import {
  COMMON_TRADES,
  EDUCATION_LEVEL_LABELS,
  EDUCATION_LEVEL_OPTIONS,
} from "@/lib/constants";
import type { CandidateProfileDTO } from "@/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/shared";

type In = z.input<typeof educationSkillsSchema>;
type Out = z.output<typeof educationSkillsSchema>;

interface EducationSkillsFormProps {
  profile: CandidateProfileDTO | null;
  onSave: (data: UpdateCandidateProfileInput) => Promise<unknown>;
  isSaving: boolean;
}

/** Sentinel for the "no secondary trade" option (Radix Select can't use ""). */
const NO_SECONDARY = "__none__";

/** Merge the saved value into the option list so a custom trade still shows. */
function tradeOptions(current: string | null | undefined): string[] {
  const base = [...COMMON_TRADES];
  if (current && !base.includes(current as (typeof COMMON_TRADES)[number])) {
    return [current, ...base];
  }
  return base;
}

function defaults(profile: CandidateProfileDTO | null): DefaultValues<In> {
  return {
    educationLevel:
      profile?.educationLevel && profile.educationLevel !== "NONE"
        ? profile.educationLevel
        : undefined,
    primaryTrade: profile?.primaryTrade ?? "",
    secondaryTrade: profile?.secondaryTrade ?? "",
    yearsOfExperience: profile?.yearsOfExperience ?? 0,
  };
}

export function EducationSkillsForm({
  profile,
  onSave,
  isSaving,
}: EducationSkillsFormProps) {
  const t = useTranslations("candidate.profile");
  const te = useTranslations("candidate.profile.education");

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(educationSkillsSchema),
    defaultValues: defaults(profile),
  });

  async function onSubmit(values: Out) {
    try {
      await onSave(values);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="educationLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{te("educationLevel")} *</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={te("educationLevelPlaceholder")}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EDUCATION_LEVEL_OPTIONS.filter((lvl) => lvl !== "NONE").map(
                      (lvl) => (
                        <SelectItem key={lvl} value={lvl}>
                          {EDUCATION_LEVEL_LABELS[lvl]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="yearsOfExperience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{te("yearsOfExperience")} *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={String(field.value ?? "")}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primaryTrade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{te("primaryTrade")} *</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={te("primaryTradePlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-72">
                    {tradeOptions(profile?.primaryTrade).map((trade) => (
                      <SelectItem key={trade} value={trade}>
                        {trade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="secondaryTrade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{te("secondaryTrade")}</FormLabel>
                <Select
                  value={field.value ? field.value : NO_SECONDARY}
                  onValueChange={(value) =>
                    field.onChange(value === NO_SECONDARY ? "" : value)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={te("secondaryTradePlaceholder")}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-72">
                    <SelectItem value={NO_SECONDARY}>
                      {te("secondaryTradeNone")}
                    </SelectItem>
                    {tradeOptions(profile?.secondaryTrade).map((trade) => (
                      <SelectItem key={trade} value={trade}>
                        {trade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <SubmitButton
            pending={isSaving}
            idleLabel={t("save")}
            pendingLabel={t("saving")}
            className="w-auto"
          />
        </div>
      </form>
    </Form>
  );
}
