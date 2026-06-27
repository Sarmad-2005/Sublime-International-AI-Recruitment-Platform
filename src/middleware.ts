import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME_ROUTE, ROUTES, type UserRole } from "@/lib/constants";

/**
 * Auth + role-based route protection (Action #7).
 *
 * ⚠️ PLACEHOLDER: session resolution is not wired yet — `getSessionUser`
 * currently returns `null`. Once Supabase auth is connected, decode the session
 * cookie there (via `@supabase/ssr`), resolve the SIORP user + role, and the
 * routing rules below will start enforcing access.
 */

interface ProtectedArea {
  prefix: string;
  roles: UserRole[];
}

/** Which roles may access each portal path prefix. */
const PROTECTED_AREAS: ProtectedArea[] = [
  { prefix: ROUTES.ADMIN, roles: ["SUPER_ADMIN", "ADMIN"] },
  { prefix: ROUTES.CLIENT, roles: ["SAUDI_CLIENT"] },
  { prefix: ROUTES.CANDIDATE, roles: ["CANDIDATE"] },
  { prefix: ROUTES.MEDICAL, roles: ["MEDICAL_OFFICER"] },
];

const AUTH_ROUTES: string[] = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
];

function matchProtectedArea(pathname: string): ProtectedArea | undefined {
  return PROTECTED_AREAS.find(
    (area) => pathname === area.prefix || pathname.startsWith(`${area.prefix}/`),
  );
}

/**
 * Resolve the authenticated SIORP user from the request.
 * TODO(auth): replace the placeholder with a real Supabase session lookup.
 */
async function getSessionUser(
  request: NextRequest,
): Promise<{ role: UserRole } | null> {
  // Placeholder: a real implementation validates the Supabase auth cookie and
  // resolves the user's role from the database.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));

  if (!hasSessionCookie) return null;

  // TODO(auth): decode session -> return { role }.
  return null;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const user = await getSessionUser(request);
  const protectedArea = matchProtectedArea(pathname);

  // 1. Unauthenticated user hitting a protected portal -> redirect to login.
  if (protectedArea && !user) {
    const loginUrl = new URL(ROUTES.LOGIN, request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated user without the required role -> send to their own portal.
  if (protectedArea && user && !protectedArea.roles.includes(user.role)) {
    return NextResponse.redirect(new URL(ROLE_HOME_ROUTE[user.role], request.url));
  }

  // 3. Authenticated user on an auth page -> bounce to their portal home.
  if (user && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL(ROLE_HOME_ROUTE[user.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Run on all routes except Next.js internals, static assets and API routes.
   * API routes do their own auth checks.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
