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
  // OpenNext copies listed external packages with a `workerd` export condition
  // into the server-function tree. `pg` conditionally requires this package
  // when it runs in Cloudflare Workers.
  serverExternalPackages: ["pg-cloudflare"],
  // Capture Tracker uses only fixed local brand assets. OpenNext's runtime
  // image optimizer requires a separate Cloudflare Images binding, which is
  // intentionally out of scope for the fictional no-cost preview. Keep the
  // Image component and serve those assets as-is instead of leaving Sharp's
  // Node-native conditional path reachable in the Worker runtime.
  images: { unoptimized: true },
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
