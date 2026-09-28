import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tuned for Freebuff: HMR stays off; nothing sensitive is exposed to the client.
  reactStrictMode: true,
};

export default nextConfig;
