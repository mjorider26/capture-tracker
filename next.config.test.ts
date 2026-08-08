import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("authenticated response headers", () => {
  it("prevents mobile browsers from retaining obsolete authenticated RSC payloads", async () => {
    const rules = await nextConfig.headers?.();
    const application = rules?.find((rule) => rule.source === "/app/:path*");
    expect(application?.headers).toContainEqual({ key: "Cache-Control", value: "private, no-store" });
  });
});
