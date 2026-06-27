import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Prisma 7 client + pg driver adapter run on the Node.js runtime only.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  // Uncomment and set your project ref to serve Supabase Storage images:
  // images: {
  //   remotePatterns: [
  //     { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
  //   ],
  // },
};

export default withNextIntl(nextConfig);
