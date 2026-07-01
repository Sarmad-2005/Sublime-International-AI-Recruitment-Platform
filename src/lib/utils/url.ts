import { clientEnv } from "@/lib/env";

/**
 * Build an absolute URL from an app-relative path using `NEXT_PUBLIC_APP_URL`.
 * Shared across services that compose links for emails / notifications, so the
 * base-URL logic lives in exactly one place.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, clientEnv.NEXT_PUBLIC_APP_URL).toString();
}
