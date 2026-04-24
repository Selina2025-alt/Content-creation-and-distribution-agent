import type { NextConfig } from "next";

const isProductionBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  distDir: isProductionBuild ? ".next" : ".next-dev",
  reactStrictMode: true,
  devIndicators: false,
  experimental: {
    browserDebugInfoInTerminal: false,
    devtoolSegmentExplorer: false,
    turbopackPersistentCaching: false
  },
  webpack(config, { dev }) {
    if (dev) {
      config.cache = false;
    }

    return config;
  }
};

export default nextConfig;
