"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Error boundary for the admin portal. Renders inside the admin chrome (the
 * layout persists) whenever a page or one of its server data fetches throws, and
 * offers a retry that re-runs the failed render via `reset()`.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("admin.error");

  useEffect(() => {
    // Surface the failure for diagnostics (server `digest` correlates the log).
    console.error("Admin portal error:", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <span className="bg-destructive/10 text-destructive grid size-12 place-items-center rounded-full">
            <AlertTriangle className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
          <Button variant="brand" onClick={reset} className="mt-1">
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
