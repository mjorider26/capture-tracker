import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Financial routes are dynamic and no-store. Do not add R2 incremental caching
// until its privacy and invalidation behavior has been separately reviewed.
const config = defineCloudflareConfig({
  // Next 16 defaults to Turbopack for production builds. Its server-function
  // output currently retains duplicate runtime chunks in the final Worker.
  // OpenNext supports an explicit Next build command; Webpack produces the
  // equivalent application build without those duplicate Worker inputs.
});

config.buildCommand = "node scripts/build-cloud-worker.mjs";

export default config;
