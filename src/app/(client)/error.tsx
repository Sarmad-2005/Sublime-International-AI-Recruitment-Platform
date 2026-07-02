"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Error boundary for the client portal. Renders inside the portal chrome
 * whenever a page or one of its server data fetches throws, and offers a retry.
 */
export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Client portal error:", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <span className="bg-destructive/10 text-destructive grid size-12 place-items-center rounded-full">
            <AlertTriangle className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground text-sm">
            We couldn&apos;t load this page. Please try again in a moment.
          </p>
          <Button variant="brand" onClick={reset} className="mt-1">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
