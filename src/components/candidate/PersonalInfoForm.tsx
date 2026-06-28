"use client";

import { z } from "zod";
import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  personalInfoSchema,
  formatCnic,
  formatPakistaniPhone,
  type UpdateCandidateProfileInput,
} from "@/lib/validations";
import {
  EMERGENCY_RELATIONS,
  GENDER_LABELS,
  GENDER_OPTIONS,
  MARITAL_STATUS_LABELS,
  MARITAL_STATUS_OPTIONS,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/shared";

type In = z.input<typeof personalInfoSchema>;
type Out = z.output<typeof personalInfoSchema>;

interface PersonalInfoFormProps {
  profile: CandidateProfileDTO | null;
  onSave: (data: UpdateCandidateProfileInput) => Promise<unknown>;
  isSaving: boolean;
}

function defaults(profile: CandidateProfileDTO | null): DefaultValues<In> {
  return {
    fullName: profile?.fullName ?? "",
    fatherName: profile?.fatherName ?? "",
    cnic: profile?.cnic ?? "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    gender: profile?.gender,
    nationality: profile?.nationality ?? "Pakistani",
    maritalStatus: profile?.maritalStatus ?? undefined,
    religion: profile?.religion ?? "",
    passportNumber: profile?.passportNumber ?? "",
    passportIssueDate: profile?.passportIssueDate ?? "",
    passportExpiryDate: profile?.passportExpiryDate ?? "",
    passportIssuePlace: profile?.passportIssuePlace ?? "",
    permanentAddress: profile?.permanentAddress ?? "",
    currentAddress: profile?.currentAddress ?? "",
    city: profile?.city ?? "",
    province: profile?.province ?? "",
    country: profile?.country ?? "Pakistan",
    postalCode: profile?.postalCode ?? "",
    emergencyContactName: profile?.emergencyContactName ?? "",
    emergencyContactRelation: profile?.emergencyContactRelation ?? "",
    emergencyContactPhone: profile?.emergencyContactPhone ?? "",
    emergencyContactAddress: profile?.emergencyContactAddress ?? "",
  };
}

export function PersonalInfoForm({
  profile,
  onSave,
  isSaving,
}: PersonalInfoFormProps) {
  const t = useTranslations("candidate.profile");
  const tf = useTranslations("candidate.profile.personal");

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(personalInfoSchema),
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {/* Identity */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">{tf("identityHeading")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("fullName")} *</FormLabel>
                  <FormControl>
                    <Input placeholder={tf("fullNamePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fatherName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("fatherName")} *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cnic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("cnic")} *</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder={tf("cnicPlaceholder")}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(formatCnic(e.target.value))}
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
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("dateOfBirth")} *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("gender")} *</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={tf("genderPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {GENDER_LABELS[g]}
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
              name="maritalStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("maritalStatus")}</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={tf("maritalStatusPlaceholder")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MARITAL_STATUS_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {MARITAL_STATUS_LABELS[m]}
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
              name="nationality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("nationality")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="religion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("religion")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        {/* Passport */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">{tf("passportHeading")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="passportNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("passportNumber")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passportIssuePlace"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("passportIssuePlace")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passportIssueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("passportIssueDate")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passportExpiryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("passportExpiryDate")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        {/* Address */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">{tf("addressHeading")}</legend>
          <FormField
            control={form.control}
            name="permanentAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tf("permanentAddress")} *</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currentAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tf("currentAddress")}</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("city")} *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("province")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("postalCode")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem className="sm:max-w-xs">
                <FormLabel>{tf("country")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        {/* Emergency contact */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">{tf("emergencyHeading")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("emergencyName")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContactRelation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("emergencyRelation")}</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={tf("emergencyRelationPlaceholder")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EMERGENCY_RELATIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
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
              name="emergencyContactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("emergencyPhone")}</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder={tf("emergencyPhonePlaceholder")}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(formatPakistaniPhone(e.target.value))
                      }
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
              name="emergencyContactAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tf("emergencyAddress")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3">
          <p className="text-muted-foreground mr-auto text-xs">
            {t("requiredNote")}
          </p>
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
