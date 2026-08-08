import { describe, expect, it } from "vitest";

import { workspaceClientFailureMetadata, workspaceFailureMetadata } from "./workspace-failure";

describe("workspaceFailureMetadata", () => {
  it("records a finite scan-schema category without retaining the raw error", () => {
    expect(workspaceFailureMetadata("today_dashboard", new Error("Document malwareScanStatus column is unavailable"))).toEqual({
      event: "workspace_load_failed",
      scope: "today_dashboard",
      category: "DOCUMENT_SCAN_SCHEMA",
      name: "Error",
    });
  });

  it("keeps an allowed Prisma code but never the raw message", () => {
    expect(workspaceFailureMetadata("business_context", { name: "PrismaClientKnownRequestError", code: "P2022", message: "private query detail" })).toEqual({
      event: "workspace_load_failed",
      scope: "business_context",
      category: "DATABASE_QUERY",
      code: "P2022",
      name: "PrismaClientKnownRequestError",
    });
  });

  it("reports a finite client category without retaining the message", () => {
    expect(workspaceClientFailureMetadata({ message: "Loading chunk 12 failed", digest: "safe_digest" }, "/app/documents")).toEqual({
      category: "CLIENT_ASSET",
      pathname: "/app/documents",
      digest: "safe_digest",
    });
  });
});
