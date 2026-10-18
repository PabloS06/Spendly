import type { NextConfig } from "next";

// Static export: the app is fully client-side and talks to Supabase directly,
// with row-level security doing the access control.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
