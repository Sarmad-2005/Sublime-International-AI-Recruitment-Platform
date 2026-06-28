import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Forwarded from the route layout to apply the Inter font class. */
  className?: string;
}

/**
 * Two-panel chrome shared by every auth screen.
 *
 * Left panel: platform branding, tagline and headline stats.
 * Right panel: the form card (passed as `children`).
 *
 * Mobile-first: the panels stack (branding above the form card) and the split
 * only kicks in from `lg`. Pure presentation — no interactivity — so this stays
 * a Server Component and reads its copy straight from the request-scoped
 * next-intl config.
 */
export function AuthLayout({ children, className }: AuthLayoutProps) {
  const t = useTranslations("auth.layout");

  const stats = [
    { value: t("stats.candidates.value"), label: t("stats.candidates.label") },
    { value: t("stats.employers.value"), label: t("stats.employers.label") },
    { value: t("stats.success.value"), label: t("stats.success.label") },
  ];

  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-navy text-white",
        className,
      )}
    >
      {/* Subtle diagonal pattern overlay. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(135deg,#ffffff_0,#ffffff_1px,transparent_1px,transparent_15px)]"
      />
      {/* Soft brand glow to add depth behind the form card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-royal/20 blur-3xl"
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row">
        {/* Branding panel */}
        <aside className="flex flex-col justify-between gap-10 px-6 py-10 sm:px-10 lg:w-1/2 lg:py-16">
          <div className="space-y-1.5">
            <p className="text-lg font-bold tracking-[0.18em] text-white sm:text-xl">
              {t("brand")}
            </p>
            <span className="block h-1 w-14 rounded-full bg-gold" />
          </div>

          <div className="max-w-md space-y-4">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {t("tagline")}
            </h1>
            <p className="text-base leading-relaxed text-white/70 sm:text-lg">
              {t("description")}
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="space-y-1">
                <dt className="text-2xl font-bold text-gold sm:text-3xl">
                  {stat.value}
                </dt>
                <dd className="text-xs leading-snug text-white/60 sm:text-sm">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>

          <p className="hidden text-xs text-white/40 lg:block">{t("footer")}</p>
        </aside>

        {/* Form panel */}
        <main className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-8 lg:py-16">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-foreground shadow-2xl ring-1 ring-black/5 sm:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
