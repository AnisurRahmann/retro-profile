import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Test builds (pnpm e2e) go to .next-e2e so they never overwrite the production build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  // The sky's e2e hooks (window.__sky) and debug switches are compiled in only when these are set at build time. Where
  // one is not set, Next would leave a runtime lookup that the minifier cannot fold, so the code behind it shipped in
  // every production bundle (v5.1: it put the renderer over its budget). scripts/check-bundle.ts checks that it doesn't.
  env: {
    NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E ?? "",
    NEXT_PUBLIC_SKY_DEBUG: process.env.NEXT_PUBLIC_SKY_DEBUG ?? "",
  },
  images: { formats: ["image/avif", "image/webp"] },
  async redirects() {
    return [
      { source: "/gym", destination: "/lifts", permanent: true },
    ];
  },
};

export default nextConfig;
