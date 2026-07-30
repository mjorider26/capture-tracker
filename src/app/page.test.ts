import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

describe("root page entry actions", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("offers a visible sign-in action without exposing a local demo route", async () => {
    getSession.mockResolvedValue(null);
    const { default: Home } = await import("./page");

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("Sign in");
    expect(html).toContain("fictional staging environment");
    expect(html).not.toContain("/demo/");
    expect(html).not.toContain("Open application");
  });

  it("offers the application action only to an authenticated user", async () => {
    getSession.mockResolvedValue({ session: { id: "fictional-session" } });
    const { default: Home } = await import("./page");

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain('href="/app"');
    expect(html).toContain("Open application");
  });
});
