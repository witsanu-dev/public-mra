import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/mra',
  skipTrailingSlashRedirect: true,
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
