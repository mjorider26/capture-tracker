import { describe, expect, it, vi } from "vitest";
import { inspectHealthResponse } from "@/lib/health-contract.mjs";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cloud/logging", () => ({ logServerEvent: vi.fn() }));
vi.mock("@/lib/prisma", () => { throw new Error("DATABASE_URL is not configured."); });

describe("health routes", () => {
  it("returns the shared liveness contract", async () => {
    const { GET } = await import("./live/route");
    const response = GET();
    await expect(inspectHealthResponse(response, "live")).resolves.toMatchObject({ httpStatus: 200, contractResult: "pass", state: "live" });
  });

  it("returns the shared fail-closed readiness contract when Prisma cannot load", async () => {
    const { GET } = await import("./ready/route");
    const response = await GET();
    await expect(inspectHealthResponse(response, "readyFailClosed")).resolves.toMatchObject({ httpStatus: 503, contractResult: "pass", state: "not_ready" });
  });
});
