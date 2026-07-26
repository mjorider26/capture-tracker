import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep Turbopack within this repository when a parent directory has another
  // lockfile; it must not scan a user home directory during builds.
  turbopack: { root: projectRoot },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
