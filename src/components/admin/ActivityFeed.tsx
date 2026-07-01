"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  formatAuditLogActivity,
  type AuditLogActivity,
} from "@/lib/utils/activity";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActivityItem } from "@/types";

/** Cap the feed at the most recent N events (SRS: last 20). */
const MAX_ITEMS = 20;

/** Raw `audit_logs` row as delivered by Supabase Realtime (snake_case). */
interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  new_value: unknown;
  created_at: string;
}

function isAuditLogRow(value: unknown): value is AuditLogRow {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as AuditLogRow).id === "string" &&
    typeof (value as AuditLogRow).action === "string" &&
    typeof (value as AuditLogRow).entity_type === "string"
  );
}

function toActivity(row: AuditLogRow): ActivityItem {
  const normalised: AuditLogActivity = {
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    newValue: row.new_value,
    createdAt: row.created_at,
  };
  return formatAuditLogActivity(normalised);
}

/**
 * Recent-activity feed for the admin dashboard. Seeded with the server-fetched
 * events, then kept live via a Supabase Realtime subscription on `audit_logs`:
 * each newly inserted audit row is prepended in place (no refetch).
 */
export function ActivityFeed({ initialItems }: { initialItems: ActivityItem[] }) {
  const t = useTranslations("admin.dashboard.activity");
  const [items, setItems] = useState<ActivityItem[]>(initialItems);

  // Keep in sync if the server re-renders with a fresh feed.
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("admin-activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        (payload) => {
          if (!isAuditLogRow(payload.new)) return;
          const next = toActivity(payload.new);
          setItems((prev) => {
            if (prev.some((item) => item.id === next.id)) return prev;
            return [next, ...prev].slice(0, MAX_ITEMS);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          <ol className="relative space-y-5 border-l pl-5">
            {items.map((item) => (
              <li key={item.id} className="relative">
                <span className="bg-royal ring-background absolute top-1 -left-[1.4rem] size-2.5 rounded-full ring-4" />
                {item.href ? (
                  <Link
                    href={item.href}
                    className="hover:text-royal text-sm font-medium transition-colors"
                  >
                    {item.message}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{item.message}</p>
                )}
                <p className="text-muted-foreground/80 text-xs">
                  {formatDistanceToNow(new Date(item.timestamp), {
                    addSuffix: true,
                  })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
