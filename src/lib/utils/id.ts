/**
 * Generate a stable, collision-resistant client-side id. Prefers the native
 * `crypto.randomUUID()`; falls back to a random+timestamp string on the rare
 * platform without it. Used for answer-option ids that must survive edits and
 * reorders (scoring keys off them).
 */
export function randomId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
