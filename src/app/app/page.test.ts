import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((destination: string) => {
  throw new Error(`redirect:${destination}`);
});

vi.mock("next/navigation", () => ({ redirect }));

describe("application root", () => {
  it("routes an authenticated application entry to the dashboard", async () => {
    const { default: ApplicationHomePage } = await import("./page");

    expect(() => ApplicationHomePage()).toThrow("redirect:/app/today");
    expect(redirect).toHaveBeenCalledWith("/app/today");
  });
});
