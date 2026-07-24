import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Financial routes are dynamic and no-store. Do not add R2 incremental caching
// until its privacy and invalidation behavior has been separately reviewed.
export default defineCloudflareConfig({
});
