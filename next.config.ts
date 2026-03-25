import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["@prisma/client", "bcryptjs", "three", "@react-three/fiber", "@react-three/drei", "xlsx"],
};

export default nextConfig;
