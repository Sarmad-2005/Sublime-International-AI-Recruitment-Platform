import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_HEADERS,
  AUTH_REDIRECT_PARAM,
  ROLE_HOME_ROUTE,
  ROUTES,
  type UserRole,
} from "@/lib/constants";
import { updateSession } from "@/lib/supabase/middleware";
import { extractUserRole } from "@/lib/supabase/roles";

/**
 * Auth + role-based route protection.
 *
 * On every matched request we:
 *   1. Refresh the Supabase session (so tokens never silently expire).
 *   2. Resolve the caller's role from the validated session.
 *   3. Enforce the route → role map below, redirecting as needed.
 *   4. On allowed requests, forward the user id + role as request headers so
 *      downstream Server Components / Route Handlers can read them cheaply.
 */

interface ProtectedArea {
  prefix: string;
  roles: readonly UserRole[];
}

/** Which roles may access each portal path prefix. */
const PROTECTED_AREAS: readonly ProtectedArea[] = [
  { prefix: ROUTES.ADMIN, roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: ROUTES.CLIENT, roles: ["SAUDI_CLIENT"] },
  { prefix: ROUTES.CANDIDATE, roles: ["CANDIDATE"] },
  { prefix: ROUTES.MEDICAL, roles: ["MEDICAL_OFFICER"] },
];

/**
 * Auth pages an *already authenticated* user is still allowed to view. The
 * password-recovery screen establishes a short-lived session via the email
 * link, so bouncing logged-in users away from it would break that flow.
 */
const AUTH_ROUTES_ALLOW_AUTHENTICATED: readonly string[] = [
  ROUTES.RESET_PASSWORD,
];

function matchProtectedArea(pathname: string): ProtectedArea | undefined {
  return PROTECTED_AREAS.find(
    (area) => pathname === area.prefix || pathname.startsWith(`${area.prefix}/`),
  );
}

function isAuthRoute(pathname: string): boolean {
  return pathname === ROUTES.AUTH || pathname.startsWith(`${ROUTES.AUTH}/`);
}

function redirectTo(path: string, request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1. Always refresh the session first so the token stays alive and cookies are
  //    written back onto whatever response we return (via `applyTo`).
  const { user, applyTo } = await updateSession(request);
  const role = user ? extractUserRole(user) : null;

  const protectedArea = matchProtectedArea(pathname);

  // 2. Protected portal route.
  if (protectedArea) {
    // Not signed in (or role indeterminate) → send to login, remembering where.
    if (!user || !role) {
      const loginUrl = new URL(ROUTES.LOGIN, request.url);
      loginUrl.searchParams.set(AUTH_REDIRECT_PARAM, pathname);
      return applyTo(NextResponse.redirect(loginUrl));
    }

    // Signed in but wrong role for this portal → send to their own dashboard.
    if (!protectedArea.roles.includes(role)) {
      return applyTo(redirectTo(ROLE_HOME_ROUTE[role], request));
    }
  }

  // 3. Authenticated user on an auth page → bounce to their dashboard, unless the
  //    page is one that authenticated users are allowed to see (e.g. reset).
  if (
    user &&
    role &&
    isAuthRoute(pathname) &&
    !AUTH_ROUTES_ALLOW_AUTHENTICATED.includes(pathname)
  ) {
    return applyTo(redirectTo(ROLE_HOME_ROUTE[role], request));
  }

  // 4. Allowed. Forward identity to downstream handlers via request headers.
  const requestHeaders = new Headers(request.headers);
  if (user && role) {
    requestHeaders.set(AUTH_HEADERS.USER_ID, user.id);
    requestHeaders.set(AUTH_HEADERS.USER_ROLE, role);
  } else {
    // Strip any client-supplied spoofed headers when there is no session.
    requestHeaders.delete(AUTH_HEADERS.USER_ID);
    requestHeaders.delete(AUTH_HEADERS.USER_ROLE);
  }

  return applyTo(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  /**
   * Run on all routes except Next.js internals, static assets and API routes.
   * API routes do their own auth checks (they read cookies via the server client).
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
