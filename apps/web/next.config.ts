import type { NextConfig } from "next";

const API_TARGET = process.env.API_URL ?? "http://localhost:3333";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy /api/* to the NestJS backend.
      // Why: keeps cookies same-origin (browser → localhost:3000 → API),
      // avoiding the SameSite=None+Secure dance required for cross-origin.
      {
        source: "/api/:path*",
        destination: `${API_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
