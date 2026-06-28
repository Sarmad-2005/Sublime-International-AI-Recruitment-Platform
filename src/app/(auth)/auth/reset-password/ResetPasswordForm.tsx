"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, ShieldAlert } from "lucide-react";

import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AuthHeading,
  AuthResultPanel,
  PasswordInput,
  SubmitButton,
} from "@/components/shared";
import { resetPasswordAction } from "../actions";

type Status = "form" | "success" | "invalid";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const code = useSearchParams().get("code");

  // A missing recovery code means the link is broken before we even try.
  const [status, setStatus] = useState<Status>(code ? "form" : "invalid");

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: ResetPasswordInput) {
    const result = await resetPasswordAction({
      code,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });

    if (!result.ok) {
      toast.error(result.error);
      if (result.code === "INVALID_LINK") setStatus("invalid");
      return;
    }

    toast.success(t("reset.success.toast"));
    setStatus("success");
  }

  if (status === "invalid") {
    return (
      <AuthResultPanel
        tone="danger"
        icon={<ShieldAlert className="size-7 text-destructive" aria-hidden />}
        title={t("reset.invalid.title")}
        body={t("reset.invalid.body")}
      >
        <Button asChild variant="brand" size="lg" className="w-full">
          <Link href={ROUTES.FORGOT_PASSWORD}>{t("reset.invalid.requestNew")}</Link>
        </Button>
      </AuthResultPanel>
    );
  }

  if (status === "success") {
    return (
      <AuthResultPanel
        tone="success"
        icon={<CheckCircle2 className="size-7 text-emerald-600" aria-hidden />}
        title={t("reset.success.title")}
        body={t("reset.success.body")}
      >
        <Button asChild variant="brand" size="lg" className="w-full">
          <Link href={ROUTES.LOGIN}>{t("reset.success.goToLogin")}</Link>
        </Button>
      </AuthResultPanel>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeading title={t("reset.title")} subtitle={t("reset.subtitle")} />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("reset.passwordLabel")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("reset.passwordPlaceholder")}
                    showLabel={t("common.showPassword")}
                    hideLabel={t("common.hidePassword")}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{t("reset.passwordHint")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("reset.confirmPasswordLabel")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("reset.confirmPasswordPlaceholder")}
                    showLabel={t("common.showPassword")}
                    hideLabel={t("common.hidePassword")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <SubmitButton
            pending={isSubmitting}
            idleLabel={t("reset.submit")}
            pendingLabel={t("reset.submitting")}
          />
        </form>
      </Form>
    </div>
  );
}
