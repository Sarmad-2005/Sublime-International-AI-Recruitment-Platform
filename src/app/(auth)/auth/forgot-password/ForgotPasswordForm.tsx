"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AuthHeading,
  AuthResultPanel,
  BackToLoginLink,
  SubmitButton,
} from "@/components/shared";
import { forgotPasswordAction } from "../actions";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: ForgotPasswordInput) {
    const result = await forgotPasswordAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSentTo(values.email);
  }

  async function handleResend(email: string) {
    const result = await forgotPasswordAction({ email });
    if (result.ok) toast.success(t("forgot.success.resentToast"));
    else toast.error(result.error);
  }

  if (sentTo) {
    return (
      <AuthResultPanel
        icon={<Mail className="size-7 text-royal" aria-hidden />}
        title={t("forgot.success.title")}
        body={t("forgot.success.body", { email: sentTo })}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => handleResend(sentTo)}
        >
          {t("forgot.success.resend")}
        </Button>
      </AuthResultPanel>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeading title={t("forgot.title")} subtitle={t("forgot.subtitle")} />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("forgot.emailLabel")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("forgot.emailPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <SubmitButton
            pending={isSubmitting}
            idleLabel={t("forgot.submit")}
            pendingLabel={t("forgot.submitting")}
          />
        </form>
      </Form>

      <BackToLoginLink className="w-full" />
    </div>
  );
}
