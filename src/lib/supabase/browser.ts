import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";

/**
 * Supabase client for Client Components (browser).
 *
 * Uses the public anon key — never the service-role key. `@supabase/ssr`
 * persists the session in cookies so it stays in sync with the server clients
 * and the middleware session refresh.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
