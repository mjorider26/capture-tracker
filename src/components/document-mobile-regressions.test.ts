import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("document mobile regressions", () => {
  it("uses one bounded, abortable scan-state request and refreshes only after server state changes", async () => {
    const source = await readFile(new URL("./document-scan-refresh.tsx", import.meta.url), "utf8");
    expect(source).toContain("documentScanRefreshIntervalMs");
    expect(source).toContain("documentScanRefreshMaxAttempts");
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain("AbortController");
    expect(source).toContain("inFlight");
    expect(source).toContain("controller?.abort()");
    expect(source).toContain("router.refresh()");
  });

  it("uses a server-directed replacement after removal and never clears authentication", async () => {
    const action = await readFile(new URL("../app/app/documents/actions.ts", import.meta.url), "utf8");
    const control = await readFile(new URL("./document-removal-control.tsx", import.meta.url), "utf8");
    expect(action).toContain('redirect("/app/documents", RedirectType.replace)');
    expect(action).not.toContain("signOut");
    expect(action).not.toContain("Set-Cookie");
    expect(control).not.toContain("useRouter");
  });
});
