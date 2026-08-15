import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/operations/**/*.test.ts", "scripts/production-backup-observability-core.test.ts", "scripts/production-logical-backup-core.test.ts", "scripts/production-logical-migration-state.test.ts", "scripts/production-logical-restore-core.test.ts"],
  },
});
