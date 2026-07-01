import { ROUTES } from "@/lib/constants";
import type { ActivityItem } from "@/types";

/**
 * Audit-log → activity-feed presentation helpers. Pure and framework-free (no
 * `server-only`/Prisma imports) so the same formatter runs both server-side when
 * the admin dashboard loads its initial feed and client-side when the Supabase
 * Realtime subscription receives a brand-new `audit_logs` row.
 */

/**
 * The subset of an `AuditLog` row the feed needs, normalised to camelCase. Both
 * the Prisma read (server) and the realtime payload (snake_case, mapped by the
 * caller) reduce to this shape before formatting.
 */
export interface AuditLogActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  /** Free-form JSON snapshot written alongside the action. */
  newValue: unknown;
  /** ISO timestamp. */
  createdAt: string;
}

/** Title-case a SCREAMING_SNAKE / kebab token, e.g. `TIER_ASSIGNED` → "Tier assigned". */
function humanize(token: string): string {
  const words = token
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return token;
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Pull a string field off the `newValue` JSON snapshot, if present. */
function readSnapshotString(newValue: unknown, key: string): string | null {
  if (newValue && typeof newValue === "object" && !Array.isArray(newValue)) {
    const value = (newValue as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

/**
 * Map an entity type + id to its admin deep link. Unknown entity types (or rows
 * with no id) get no link.
 */
function activityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType.toUpperCase()) {
    case "APPLICATION":
      return `${ROUTES.ADMIN}/applications/${entityId}`;
    case "CANDIDATE":
    case "CANDIDATE_PROFILE":
      return `${ROUTES.ADMIN}/candidates/${entityId}`;
    case "JOB_POST":
    case "JOBPOST":
      return `${ROUTES.ADMIN}/jobs/${entityId}`;
    case "LIVE_INTERVIEW":
    case "LIVE_INTERVIEW_SESSION":
      return `${ROUTES.ADMIN}/live-interviews/${entityId}`;
    case "POST_SELECTION":
    case "POST_SELECTION_RECORD":
      return `${ROUTES.ADMIN}/post-selection/${entityId}`;
    case "USER":
      return `${ROUTES.ADMIN}/users/${entityId}`;
    default:
      return null;
  }
}

/**
 * Turn an audit-log row into a feed item. Writers may include a ready-made
 * `message`/`summary`/`description` in the `newValue` snapshot — that wins so the
 * feed reads naturally (e.g. "Ahmad Khan completed AI Interview — Score: 78").
 * Otherwise we fall back to a generic `<Action> · <Entity>` line.
 */
export function formatAuditLogActivity(row: AuditLogActivity): ActivityItem {
  const message =
    readSnapshotString(row.newValue, "message") ??
    readSnapshotString(row.newValue, "summary") ??
    readSnapshotString(row.newValue, "description") ??
    `${humanize(row.action)} · ${humanize(row.entityType)}`;

  return {
    id: row.id,
    message,
    href: activityHref(row.entityType, row.entityId),
    timestamp: row.createdAt,
  };
}
