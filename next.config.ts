import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { localDevOrigins } from "./src/lib/security/local-dev-origins";

const projectRoot = dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}

const allowedDevOrigins = process.env.NODE_ENV !== "production"
  ? localDevOrigins()
  : [];

const nextConfig: NextConfig = {
  output: "standalone",
  // OpenNext copies listed external packages with a `workerd` export condition
  // into the server-function tree. `pg` conditionally requires this package
  // when it runs in Cloudflare Workers.
  serverExternalPackages: [
    "pg-cloudflare",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
  ],
  // Capture Tracker uses only fixed local brand assets. OpenNext's runtime
  // image optimizer requires a separate Cloudflare Images binding, which is
  // intentionally out of scope for the fictional no-cost preview. Keep the
  // Image component and serve those assets as-is instead of leaving Sharp's
  // Node-native conditional path reachable in the Worker runtime.
  images: { unoptimized: true },
  // Keep Turbopack within this repository when a parent directory has another
  // lockfile; it must not scan a user home directory during builds.
  turbopack: { root: projectRoot },
  // Prisma's Workerd client imports its query compiler as an async WASM module.
  // This keeps it as a deployable module instead of embedding a base64 copy in
  // the Worker bundle.
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  // Development-only Next resource access for explicitly configured private
  // LAN addresses. This does not affect API CORS or production behavior.
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  experimental: {
    // Next Server Actions default to a 1 MB request body, while the existing
    // document boundary admits a 10 MiB file. Reserve a small multipart
    // envelope without increasing the document validator's 10 MiB limit.
    serverActions: { bodySizeLimit: "11mb" },
  },
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex" },
          // Authenticated RSC responses must never survive a deployment in a
          // mobile browser cache with an obsolete client bundle.
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
