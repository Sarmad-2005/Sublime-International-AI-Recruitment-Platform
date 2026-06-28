"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Bell,
  Briefcase,
  CheckCheck,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markNotificationsReadAction } from "@/app/(candidate)/actions";
import type { NotificationFeed } from "@/types";

interface CandidateShellProps {
  fullName: string;
  email: string | null;
  profilePhotoUrl: string | null;
  notifications: NotificationFeed;
  children: React.ReactNode;
}

interface NavItem {
  key: "dashboard" | "jobs" | "profile";
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: ROUTES.CANDIDATE_DASHBOARD, icon: LayoutDashboard },
  { key: "jobs", href: `${ROUTES.CANDIDATE}/jobs`, icon: Briefcase },
  { key: "profile", href: `${ROUTES.CANDIDATE}/profile`, icon: UserRound },
];

function initialsFrom(name: string, email: string | null): string {
  const source = name.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

export function CandidateShell({
  fullName,
  email,
  profilePhotoUrl,
  notifications,
  children,
}: CandidateShellProps) {
  const t = useTranslations("candidate.nav");
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleSignOut() {
    await signOut();
    router.replace(ROUTES.LOGIN);
  }

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      {/* ---- Top navigation bar ---- */}
      <header className="bg-navy sticky top-0 z-40 text-white shadow-sm">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Link
            href={ROUTES.CANDIDATE_DASHBOARD}
            className="flex items-center gap-2"
          >
            <span className="bg-gold text-navy grid size-8 place-items-center rounded-md font-bold">
              S
            </span>
            <span className="text-lg font-bold tracking-[0.14em]">
              {t("brand")}
            </span>
          </Link>

          {/* Desktop top links */}
          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white",
                  isActive(item.href) && "bg-white/15 text-white",
                )}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell feed={notifications} />
            <UserMenu
              fullName={fullName}
              email={email}
              profilePhotoUrl={profilePhotoUrl}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ---- Desktop collapsible sidebar ---- */}
        <aside
          className={cn(
            "bg-card hidden shrink-0 border-r transition-[width] duration-200 lg:block",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col p-3">
            <nav className="flex flex-1 flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    title={collapsed ? t(item.key) : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-royal/10 text-royal"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    {!collapsed && <span>{t(item.key)}</span>}
                  </Link>
                );
              })}
            </nav>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed((c) => !c)}
              className="text-muted-foreground justify-start"
              aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
            >
              <ChevronLeft
                className={cn("size-5 transition-transform", collapsed && "rotate-180")}
              />
              {!collapsed && <span>{t("collapseSidebar")}</span>}
            </Button>
          </div>
        </aside>

        {/* ---- Main content ---- */}
        <main className="min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      {/* ---- Mobile bottom navigation ---- */}
      <nav className="bg-card fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t lg:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                active ? "text-royal" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification bell
// ---------------------------------------------------------------------------

function NotificationBell({ feed }: { feed: NotificationFeed }) {
  const t = useTranslations("candidate.nav");
  const router = useRouter();
  const [unread, setUnread] = useState(feed.unreadCount);

  async function handleOpenChange(open: boolean) {
    if (open && unread > 0) {
      setUnread(0);
      await markNotificationsReadAction();
      router.refresh();
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white hover:bg-white/10 hover:text-white"
          aria-label={t("notifications")}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="bg-gold text-navy absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full text-[10px] font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          {t("notifications")}
          {feed.unreadCount > 0 && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-normal">
              <CheckCheck className="size-3.5" />
              {t("markAllRead")}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {feed.items.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            {t("noNotifications")}
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {feed.items.map((n) => {
              const body = (
                <div
                  className={cn(
                    "flex flex-col gap-0.5 rounded-sm px-2 py-2",
                    !n.isRead && "bg-royal/5",
                  )}
                >
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="text-muted-foreground line-clamp-2 text-xs">
                    {n.message}
                  </span>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} className="block">
                  {body}
                </Link>
              ) : (
                <div key={n.id}>{body}</div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// User avatar menu
// ---------------------------------------------------------------------------

function UserMenu({
  fullName,
  email,
  profilePhotoUrl,
  onSignOut,
}: {
  fullName: string;
  email: string | null;
  profilePhotoUrl: string | null;
  onSignOut: () => void;
}) {
  const t = useTranslations("candidate.nav");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label={t("account")}
        >
          <Avatar className="size-9 border border-white/20">
            {profilePhotoUrl && (
              <AvatarImage src={profilePhotoUrl} alt={fullName} />
            )}
            <AvatarFallback className="bg-royal text-white">
              {initialsFrom(fullName, email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{fullName || t("account")}</span>
          {email && (
            <span className="text-muted-foreground truncate text-xs font-normal">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${ROUTES.CANDIDATE}/profile`}>
            <UserRound className="size-4" />
            {t("viewProfile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
          <LogOut className="size-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
