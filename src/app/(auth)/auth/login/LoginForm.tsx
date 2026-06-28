"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { signInSchema, type SignInInput } from "@/lib/validations";
import { ROUTES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthHeading, PasswordInput, SubmitButton } from "@/components/shared";
import { signInAction } from "../actions";

export function LoginForm({ redirectTo }: { redirectTo: string | null }) {
  const t = useTranslations("auth");
  const router = useRouter();

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: SignInInput) {
    const result = await signInAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("login.success"));
    router.push(redirectTo ?? result.data.redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <AuthHeading title={t("login.title")} subtitle={t("login.subtitle")} />

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
                <FormLabel>{t("login.emailLabel")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("login.emailPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel>{t("login.passwordLabel")}</FormLabel>
                  <Link
                    href={ROUTES.FORGOT_PASSWORD}
                    className="text-sm font-medium text-royal hover:text-royal-dark hover:underline"
                  >
                    {t("login.forgotPassword")}
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder={t("login.passwordPlaceholder")}
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
            idleLabel={t("login.submit")}
            pendingLabel={t("login.submitting")}
          />
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link
          href={ROUTES.REGISTER}
          className="font-semibold text-royal hover:text-royal-dark hover:underline"
        >
          {t("login.registerLink")}
        </Link>
      </p>
    </div>
  );
}
