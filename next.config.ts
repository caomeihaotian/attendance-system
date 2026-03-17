import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  webpack: (config) => {
    config.externals = config.externals || [];
    // Three.js needs canvas for some features - mark as external on server
    config.externals.push({ canvas: "canvas" });
    return config;
  },
};

export default nextConfig;
