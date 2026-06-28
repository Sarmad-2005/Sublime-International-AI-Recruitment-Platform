import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** "Back to sign in" link shared by the auth result/confirmation screens. */
export function BackToLoginLink({ className }: { className?: string }) {
  const t = useTranslations("auth");
  return (
    <Link
      href={ROUTES.LOGIN}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 text-sm font-medium text-royal hover:text-royal-dark hover:underline",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t("common.backToLogin")}
    </Link>
  );
}

const TONE_CIRCLE = {
  brand: "bg-royal/10",
  success: "bg-emerald-100",
  danger: "bg-destructive/10",
} as const;

interface AuthResultPanelProps {
  /** Controls the icon-circle background colour. The caller styles the icon. */
  tone?: keyof typeof TONE_CIRCLE;
  icon: React.ReactNode;
  title: string;
  body: string;
  /** Action area (primary button, resend control, …). */
  children?: React.ReactNode;
  /** Render the "Back to sign in" link below the actions (default: true). */
  backToLogin?: boolean;
}

/**
 * Centered confirmation/result screen shared by the "check your email",
 * password-reset success and invalid-link states.
 */
export function AuthResultPanel({
  tone = "brand",
  icon,
  title,
  body,
  children,
  backToLogin = true,
}: AuthResultPanelProps) {
  return (
    <div className="space-y-6 text-center">
      <div
        className={cn(
          "mx-auto flex size-14 items-center justify-center rounded-full",
          TONE_CIRCLE[tone],
        )}
      >
        {icon}
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-navy">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {children}
      {backToLogin ? <BackToLoginLink /> : null}
    </div>
  );
}
