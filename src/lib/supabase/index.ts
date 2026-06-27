/**
 * Client-safe Supabase barrel.
 *
 * Only the browser client and the client-safe role helpers are re-exported here
 * so this module can be imported from anywhere. The server clients live in
 * `./server` (marked `server-only`) and the Edge session helper in `./middleware`
 * must be imported directly where they are needed.
 */
export * from "./browser";
export * from "./roles";
