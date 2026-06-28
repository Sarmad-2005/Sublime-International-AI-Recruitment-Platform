import type { Metadata } from "next";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — SIORP",
};

/**
 * Login screen (Server Component). Reads an optional `?redirect=` target — set
 * by the middleware when bouncing an unauthenticated user — and hands the form
 * logic to the client component below.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo =
    typeof redirect === "string" && redirect.startsWith("/") ? redirect : null;

  return <LoginForm redirectTo={redirectTo} />;
}
