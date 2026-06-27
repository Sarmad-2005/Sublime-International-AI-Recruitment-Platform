/**
 * Client-safe Supabase barrel.
 *
 * Only the browser client is re-exported here so this module can be imported
 * from anywhere. The server clients live in `./server` (marked `server-only`)
 * and must be imported directly: `import { createSupabaseServerClient } from
 * "@/lib/supabase/server"`.
 */
export * from "./client";
