import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";

/**
 * Edge-runtime Supabase client + session refresh for Next.js middleware.
 *
 * This is deliberately separate from `./server` (which uses `next/headers` and
 * is marked `server-only`): the middleware runs on the Edge runtime and must
 * read/write cookies on the `NextRequest`/`NextResponse` pair instead.
 *
 * `updateSession` refreshes the auth token (so it never silently expires) and
 * returns the validated user plus an `applyTo` callback. The caller decides what
 * response to send (pass-through or redirect) and then calls `applyTo` so the
 * refreshed `Set-Cookie` headers ride along with it.
 */

type CookieToSet = { name: string; value: string; options: CookieOptions };

export interface SessionContext {
  /** The validated user (via `auth.getUser()`), or `null` if unauthenticated. */
  user: User | null;
  /** Copy any refreshed auth cookies onto an outgoing response. */
  applyTo: (response: NextResponse) => NextResponse;
}

export async function updateSession(
  request: NextRequest,
): Promise<SessionContext> {
  const cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(incoming) {
          for (const { name, value, options } of incoming) {
            // Keep the request view in sync for any later read in this pass…
            request.cookies.set(name, value);
            // …and stash them to write onto whatever response the caller builds.
            cookiesToSet.push({ name, value, options });
          }
        },
      },
    },
  );

  // IMPORTANT: `getUser()` re-validates the JWT against the Supabase Auth server
  // (unlike `getSession()`), so the returned user is safe to authorize against.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    user,
    applyTo(response) {
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
      return response;
    },
  };
}
