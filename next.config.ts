import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Server-only native/heavy packages: article extraction and image-card rendering.
  serverExternalPackages: ["jsdom", "@mozilla/readability", "satori", "@resvg/resvg-js"],
};

export default nextConfig;
