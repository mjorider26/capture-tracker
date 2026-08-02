import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("demo Today destination", () => {
  it("keeps Today in the dynamic demo route and loads its dashboard", async () => {
    const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('destination === "today"');
    expect(source).toContain("getTodayDashboard(context.businessId)");
    expect(source).toContain('basePath="/demo"');
  });

  it("boots the persisted fictional database before the local dev route is served", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../../../../package.json", import.meta.url), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.predev).toBe("prisma dev start capture-tracker");
  });
});
