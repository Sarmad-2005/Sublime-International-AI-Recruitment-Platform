/**
 * next-intl locale configuration.
 *
 * Phase 1 ships English only. Phase 2 adds Arabic and Urdu — the message files
 * already exist under `src/i18n/messages/`, so enabling them is just a matter
 * of moving the locale into `LOCALES` and supplying translations (Arabic is
 * RTL — wire `dir` in the root layout when it lands).
 */
export const LOCALES = ["en"] as const;

/** Locales planned for Phase 2 (kept out of `LOCALES` until translated). */
export const PHASE_2_LOCALES = ["ar", "ur"] as const;

export type Locale = (typeof LOCALES)[number];
export type Phase2Locale = (typeof PHASE_2_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Right-to-left locales (for `dir` handling in Phase 2). */
export const RTL_LOCALES: readonly string[] = ["ar"];
