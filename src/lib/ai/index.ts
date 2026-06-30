/**
 * Barrel for the AI (Google Gemini) integration (server-only). The client pulls
 * in `server-only`, so this module must never be imported from the browser.
 */
export * from "./client";
