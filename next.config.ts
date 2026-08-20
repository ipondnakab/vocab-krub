import type { NextConfig } from "next";

/**
 * T004. Dev-only query-parameter shortcuts (`/play?battle=`, `?map=`, `?challenge=`,
 * `?locale=`, `?seed=`) are gated on this flag so they are inert in production builds.
 * See quickstart.md § Development shortcuts.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_DEV_SHORTCUTS: process.env.NODE_ENV === "development" ? "1" : "",
  },
};

export default nextConfig;
