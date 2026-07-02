"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Users,
  Building2,
  UserCircle,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Navigation model
// ---------------------------------------------------------------------------

const CLIENT = ROUTES.CLIENT;

interface ClientNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When set, renders the unread badge on this item. */
  badge?: number;
}

function initialsFrom(name: string, email: string | null): string {
  const source = name.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

interface ClientShellProps {
  companyName: string;
  contactName: string;
  email: string | null;
  logoUrl: string | null;
  unreadMessages: number;
  children: React.ReactNode;
}

export function ClientShell({
  companyName,
  contactName,
  email,
  logoUrl,
  unreadMessages,
  children,
}: ClientShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems: ClientNavItem[] = [
    { label: "Dashboard", href: `${CLIENT}/dashboard`, icon: LayoutDashboard },
    { label: "My Talent Pool", href: `${CLIENT}/pool`, icon: Users },
    {
      label: "Messages",
      href: `${CLIENT}/messages`,
      icon: MessageSquare,
      badge: unreadMessages,
    },
    { label: "Profile", href: `${CLIENT}/profile`, icon: UserCircle },
  ];

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleSignOut() {
    await signOut();
    router.replace(ROUTES.LOGIN);
  }

  return (
    <div className="bg-muted/30 flex min-h-screen">
      {/* ---- Desktop navy sidebar ---- */}
      <aside className="bg-navy hidden w-64 shrink-0 flex-col text-white lg:flex">
        <SidebarBrand />
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        <SidebarFooter companyName={companyName} />
      </aside>

      {/* ---- Main column ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="bg-card sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>

          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="text-navy hidden size-5 shrink-0 sm:block" />
            <span className="text-navy truncate text-base font-semibold">
              {companyName || "Client Portal"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href={`${CLIENT}/messages`}
              className="hover:bg-accent relative grid size-9 place-items-center rounded-md"
              aria-label="Messages"
            >
              <MessageSquare className="text-muted-foreground size-5" />
              {unreadMessages > 0 && (
                <span className="bg-gold text-navy absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full text-[10px] font-bold">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
            <UserMenu
              contactName={contactName}
              companyName={companyName}
              email={email}
              logoUrl={logoUrl}
              onSignOut={handleSignOut}
            />
          </div>
        </header>

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
          <div className="bg-navy absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col text-white shadow-xl">
            <div className="flex h-16 items-center justify-between px-4">
              <SidebarBrand />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                className="text-white hover:bg-white/10 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navItems.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  onNavigate={() => setDrawerOpen(false)}
                />
              ))}
            </nav>
            <SidebarFooter companyName={companyName} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function SidebarBrand() {
  return (
    <Link
      href={ROUTES.CLIENT_DASHBOARD}
      className="flex h-16 items-center gap-2.5 px-5"
    >
      <span className="bg-gold text-navy grid size-8 place-items-center rounded-md font-bold">
        S
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-[0.12em]">SUBLIME</span>
        <span className="text-[10px] tracking-[0.2em] text-white/60">
          INTERNATIONAL
        </span>
      </span>
    </Link>
  );
}

function SidebarLink({
  item,
  active,
  onNavigate,
}: {
  item: ClientNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-white/15 text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="bg-gold text-navy grid size-5 place-items-center rounded-full text-[10px] font-bold">
          {item.badge > 9 ? "9+" : item.badge}
        </span>
      )}
    </Link>
  );
}

function SidebarFooter({ companyName }: { companyName: string }) {
  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="text-[10px] tracking-wider text-white/40 uppercase">
        Signed in as
      </p>
      <p className="truncate text-sm font-medium text-white/90">
        {companyName || "—"}
      </p>
    </div>
  );
}

function UserMenu({
  contactName,
  companyName,
  email,
  logoUrl,
  onSignOut,
}: {
  contactName: string;
  companyName: string;
  email: string | null;
  logoUrl: string | null;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
          aria-label="Account"
        >
          <Avatar className="size-9 border">
            {logoUrl && <AvatarImage src={logoUrl} alt={companyName} />}
            <AvatarFallback className="bg-navy text-white">
              {initialsFrom(contactName || companyName, email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{contactName || "Account"}</span>
          {companyName && (
            <span className="text-muted-foreground truncate text-xs font-normal">
              {companyName}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${ROUTES.CLIENT}/profile`}>
            <UserCircle className="size-4" />
            My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
