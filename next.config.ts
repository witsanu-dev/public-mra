import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/mra',
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
