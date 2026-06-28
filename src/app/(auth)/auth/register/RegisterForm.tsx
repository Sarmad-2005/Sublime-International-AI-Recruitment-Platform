"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  signUpCandidateSchema,
  type SignUpCandidateInput,
} from "@/lib/validations";
import { ROUTES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthHeading, PasswordInput, SubmitButton } from "@/components/shared";
import { registerAction } from "../actions";

export function RegisterForm() {
  const t = useTranslations("auth");
  const router = useRouter();

  const form = useForm<SignUpCandidateInput>({
    resolver: zodResolver(signUpCandidateSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: SignUpCandidateInput) {
    const result = await registerAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("register.createdToast"));
    router.push(ROUTES.LOGIN);
  }

  return (
    <div className="space-y-6">
      <AuthHeading
        title={t("register.title")}
        subtitle={t("register.subtitle")}
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("register.fullNameLabel")}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    placeholder={t("register.fullNamePlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("register.emailLabel")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("register.emailPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("register.phoneLabel")}</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={t("register.phonePlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{t("register.phoneHint")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("register.passwordLabel")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("register.passwordPlaceholder")}
                    showLabel={t("common.showPassword")}
                    hideLabel={t("common.hidePassword")}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{t("register.passwordHint")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("register.confirmPasswordLabel")}</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("register.confirmPasswordPlaceholder")}
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
            idleLabel={t("register.continue")}
            pendingLabel={t("register.creating")}
          />
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link
          href={ROUTES.LOGIN}
          className="font-semibold text-royal hover:text-royal-dark hover:underline"
        >
          {t("register.loginLink")}
        </Link>
      </p>
    </div>
  );
}
