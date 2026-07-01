"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CheckCheck,
  ChevronLeft,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  PlaneTakeoff,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  Video,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTES, USER_ROLE_LABELS, type UserRole } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAdminNotificationsReadAction } from "@/app/(admin)/actions";
import type { NotificationFeed } from "@/types";

// ---------------------------------------------------------------------------
// Navigation model
// ---------------------------------------------------------------------------

interface AdminNavItem {
  /** Key under `admin.nav.items` for the label. */
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AdminNavSection {
  /** Key under `admin.nav.sections` for the section heading. */
  titleKey: string;
  items: AdminNavItem[];
}

const ADMIN = ROUTES.ADMIN;

const NAV_SECTIONS: AdminNavSection[] = [
  {
    titleKey: "overview",
    items: [
      { key: "dashboard", href: ROUTES.ADMIN_DASHBOARD, icon: LayoutDashboard },
    ],
  },
  {
    titleKey: "recruitment",
    items: [
      { key: "jobs", href: `${ADMIN}/jobs`, icon: Briefcase },
      { key: "candidates", href: `${ADMIN}/candidates`, icon: Users },
      { key: "applications", href: `${ADMIN}/applications`, icon: ClipboardList },
    ],
  },
  {
    titleKey: "clients",
    items: [
      { key: "saudiClients", href: `${ADMIN}/clients`, icon: Building2 },
      { key: "pools", href: `${ADMIN}/pools`, icon: FolderKanban },
    ],
  },
  {
    titleKey: "assessment",
    items: [
      { key: "questionBanks", href: `${ADMIN}/question-banks`, icon: BookOpen },
      { key: "interviewSets", href: `${ADMIN}/interview-sets`, icon: MessagesSquare },
    ],
  },
  {
    titleKey: "operations",
    items: [
      { key: "postSelection", href: `${ADMIN}/post-selection`, icon: PlaneTakeoff },
      { key: "liveInterviews", href: `${ADMIN}/live-interviews`, icon: Video },
      { key: "medical", href: `${ADMIN}/medical`, icon: Stethoscope },
    ],
  },
  {
    titleKey: "system",
    items: [
      { key: "users", href: `${ADMIN}/users`, icon: ShieldCheck },
      { key: "auditLog", href: `${ADMIN}/audit-log`, icon: ScrollText },
      { key: "settings", href: `${ADMIN}/settings`, icon: Settings },
    ],
  },
];

function initialsFrom(name: string, email: string | null): string {
  const source = name.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

interface AdminShellProps {
  fullName: string;
  email: string | null;
  role: UserRole;
  profilePhotoUrl: string | null;
  notifications: NotificationFeed;
  children: React.ReactNode;
}

export function AdminShell({
  fullName,
  email,
  role,
  profilePhotoUrl,
  notifications,
  children,
}: AdminShellProps) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleSignOut() {
    await signOut();
    router.replace(ROUTES.LOGIN);
  }

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      {/* ---- Top bar ---- */}
      <header className="bg-navy sticky top-0 z-40 text-white shadow-sm">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("openNav")}
          >
            <Menu className="size-5" />
          </Button>

          <Link href={ROUTES.ADMIN_DASHBOARD} className="flex items-center gap-2">
            <span className="bg-gold text-navy grid size-8 place-items-center rounded-md font-bold">
              S
            </span>
            <span className="hidden text-lg font-bold tracking-[0.14em] sm:inline">
              {t("brand")}
            </span>
          </Link>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell feed={notifications} />
            <UserMenu
              fullName={fullName}
              email={email}
              role={role}
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
            collapsed ? "w-16" : "w-64",
          )}
        >
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
            <div className="flex-1 overflow-y-auto p-3">
              <SidebarNav collapsed={collapsed} isActive={isActive} />
            </div>
            <div className="border-t p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed((c) => !c)}
                className="text-muted-foreground w-full justify-start"
                aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
              >
                <ChevronLeft
                  className={cn(
                    "size-5 transition-transform",
                    collapsed && "rotate-180",
                  )}
                />
                {!collapsed && <span>{t("collapse")}</span>}
              </Button>
            </div>
          </div>
        </aside>

        {/* ---- Main content ---- */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      {/* ---- Mobile drawer ---- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="bg-card absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <span className="text-navy text-lg font-bold tracking-[0.14em]">
                {t("brand")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                aria-label={t("closeNav")}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <SidebarNav
                collapsed={false}
                isActive={isActive}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar navigation (shared by desktop aside + mobile drawer)
// ---------------------------------------------------------------------------

function SidebarNav({
  collapsed,
  isActive,
  onNavigate,
}: {
  collapsed: boolean;
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("admin.nav");

  return (
    <nav className="flex flex-col gap-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.titleKey} className="flex flex-col gap-1">
          {collapsed ? (
            <div className="bg-border mx-2 my-1 h-px" />
          ) : (
            <p className="text-muted-foreground/70 px-3 pb-1 text-xs font-semibold tracking-wider uppercase">
              {t(`sections.${section.titleKey}`)}
            </p>
          )}
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const label = t(`items.${item.key}`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center",
                  active
                    ? "bg-royal/10 text-royal"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

function GlobalSearch() {
  const t = useTranslations("admin.nav");
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`${ROUTES.ADMIN}/candidates?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="ml-2 hidden max-w-md flex-1 md:block lg:ml-6"
      role="search"
    >
      <div className="relative">
        <Search className="text-white/60 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="h-9 border-white/15 bg-white/10 pl-9 text-white placeholder:text-white/60 focus-visible:border-white/40 focus-visible:ring-white/20"
        />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Notification bell
// ---------------------------------------------------------------------------

function NotificationBell({ feed }: { feed: NotificationFeed }) {
  const t = useTranslations("admin.nav");
  const router = useRouter();
  const [unread, setUnread] = useState(feed.unreadCount);

  async function handleOpenChange(open: boolean) {
    if (open && unread > 0) {
      setUnread(0);
      await markAdminNotificationsReadAction();
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
// Admin profile menu
// ---------------------------------------------------------------------------

function UserMenu({
  fullName,
  email,
  role,
  profilePhotoUrl,
  onSignOut,
}: {
  fullName: string;
  email: string | null;
  role: UserRole;
  profilePhotoUrl: string | null;
  onSignOut: () => void;
}) {
  const t = useTranslations("admin.nav");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label={t("account")}
        >
          <Avatar className="size-9 border border-white/20">
            {profilePhotoUrl && <AvatarImage src={profilePhotoUrl} alt={fullName} />}
            <AvatarFallback className="bg-royal text-white">
              {initialsFrom(fullName, email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">
            {fullName || t("administrator")}
          </span>
          {email && (
            <span className="text-muted-foreground truncate text-xs font-normal">
              {email}
            </span>
          )}
          <span className="text-royal mt-0.5 text-xs font-medium">
            {USER_ROLE_LABELS[role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${ROUTES.ADMIN}/settings`}>
            <Settings className="size-4" />
            {t("settings")}
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
