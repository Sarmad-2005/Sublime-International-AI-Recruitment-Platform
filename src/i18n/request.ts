import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "./config";

/**
 * Per-request next-intl config (no i18n routing — keeps the app's route-group
 * structure intact, see src/app).
 *
 * Phase 1 is English-only, so the locale is fixed. Phase 2 will resolve it from
 * a cookie/header and switch `messages` accordingly; the structure is already
 * in place via `src/i18n/messages/<locale>.json`.
 */
export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
