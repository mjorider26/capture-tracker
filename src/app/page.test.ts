import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

describe("root page entry actions", () => {
  beforeEach(() => {
    getSession.mockReset();
    vi.unstubAllEnvs();
  });

  it("offers visible sign-in and practice-account actions without exposing a local demo route", async () => {
    vi.stubEnv("CAPTURE_TRACKER_ENVIRONMENT", "staging");
    vi.stubEnv("CAPTURE_TRACKER_DEPLOYMENT_PROFILE", "free-preview-cloudflare-neon");
    vi.stubEnv("CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED", "false");
    getSession.mockResolvedValue(null);
    const { default: Home } = await import("./page");

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("Sign in");
    expect(html).toContain('href="/create-account"');
    expect(html).toContain("Create practice account");
    expect(html).toContain("fictional staging environment");
    expect(html).not.toContain("/demo/");
    expect(html).not.toContain("Open application");
  });

  it("offers the application action only to an authenticated user", async () => {
    vi.stubEnv("CAPTURE_TRACKER_ENVIRONMENT", "staging");
    vi.stubEnv("CAPTURE_TRACKER_DEPLOYMENT_PROFILE", "free-preview-cloudflare-neon");
    vi.stubEnv("CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED", "false");
    getSession.mockResolvedValue({ session: { id: "fictional-session" } });
    const { default: Home } = await import("./page");

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain('href="/app"');
    expect(html).toContain("Open application");
  });

  it("never renders staging or practice-account copy in production", async () => {
    vi.stubEnv("CAPTURE_TRACKER_ENVIRONMENT", "production");
    vi.stubEnv("CAPTURE_TRACKER_DEPLOYMENT_PROFILE", "production-cloudflare-neon");
    vi.stubEnv("CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED", "true");
    getSession.mockResolvedValue(null);
    const { default: Home } = await import("./page");

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("private production pilot");
    expect(html).toContain("Create account");
    expect(html).not.toContain("fictional staging environment");
    expect(html).not.toContain("Create practice account");
  });
});
