import { beforeEach, describe, expect, it, vi } from "vitest";

const requireBusinessContext = vi.fn();
const redirect = vi.fn((destination: string) => {
  throw new Error(`redirect:${destination}`);
});
const notFound = vi.fn(() => {
  throw new Error("not-found");
});

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/lib/security/business-context", () => ({
  isAccessControlError: (error: unknown) =>
    typeof error === "object" && error !== null && "status" in error,
  requireBusinessContext,
}));

describe("authenticated application layout", () => {
  beforeEach(() => {
    requireBusinessContext.mockReset();
    redirect.mockClear();
    notFound.mockClear();
  });

  it("redirects signed-out visitors away from /app", async () => {
    requireBusinessContext.mockRejectedValue({ status: 401 });
    const { default: ApplicationLayout } = await import("./layout");

    await expect(ApplicationLayout({ children: "content" })).rejects.toThrow(
      "redirect:/sign-in",
    );
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("denies a signed-in identity whose workspace provisioning is incomplete", async () => {
    requireBusinessContext.mockRejectedValue({ status: 403 });
    const { default: ApplicationLayout } = await import("./layout");

    await expect(ApplicationLayout({ children: "content" })).rejects.toThrow(
      "not-found",
    );
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
