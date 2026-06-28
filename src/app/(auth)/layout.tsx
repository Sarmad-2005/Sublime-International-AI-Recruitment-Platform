import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { AuthLayout } from "@/components/shared";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], display: "swap" });

/**
 * Layout for every `(auth)` screen. Establishes the Inter font, hands the
 * request-scoped messages to Client Components via `NextIntlClientProvider`,
 * wraps the page in the branded two-panel `AuthLayout`, and mounts the toast
 * surface used for auth error/success feedback.
 */
export default async function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <AuthLayout className={inter.className}>{children}</AuthLayout>
      <Toaster />
    </NextIntlClientProvider>
  );
}
