import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Test builds (pnpm e2e) go to .next-e2e so they never overwrite the production build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  async redirects() {
    return [
      { source: "/gym", destination: "/lifts", permanent: true },
    ];
  },
};

export default nextConfig;
