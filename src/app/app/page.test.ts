import { describe, expect, it, vi } from "vitest";

const requireBusinessContext = vi.fn();
const redirect = vi.fn((destination: string) => {
  throw new Error(`redirect:${destination}`);
});
const notFound = vi.fn(() => {
  throw new Error("not-found");
});

vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/security/business-context", () => ({
  isAccessControlError: (error: unknown) =>
    typeof error === "object" && error !== null && "status" in error,
  requireBusinessContext,
}));

describe("application root", () => {
  it("authorizes an application entry once before routing it to the dashboard", async () => {
    requireBusinessContext.mockResolvedValue({ business: { id: "business" } });
    const { default: ApplicationHomePage } = await import("./page");

    await expect(ApplicationHomePage()).rejects.toThrow("redirect:/app/today");
    expect(requireBusinessContext).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/app/today");
  });

  it("preserves fail-closed signed-out and incomplete-workspace handling", async () => {
    const { default: ApplicationHomePage } = await import("./page");
    requireBusinessContext.mockRejectedValueOnce({ status: 401 });
    await expect(ApplicationHomePage()).rejects.toThrow("redirect:/sign-in");

    requireBusinessContext.mockRejectedValueOnce({ status: 403 });
    await expect(ApplicationHomePage()).rejects.toThrow("not-found");
  });
});
