import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIORP — Sublime International Online Recruitment Platform",
  description:
    "AI-powered overseas recruitment platform for the Pakistan → Saudi Arabia labor corridor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/*
        `suppressHydrationWarning`: browser extensions (Bitdefender, Grammarly,
        password managers, …) inject attributes like `bis_register` /
        `__processed_*` onto <html>/<body> before React hydrates, which would
        otherwise trip a hydration-mismatch warning. This suppresses the warning
        for these top-level elements only (not their children).
      */}
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
