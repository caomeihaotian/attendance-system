import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["@prisma/client", "bcryptjs", "three"],
};

export default nextConfig;
