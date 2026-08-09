import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { appUrl, canonicalAppBaseUrl } from "./app-url";

describe("canonical application URL", () => {
  it("prefers the explicit base URL and does not retain request fragments", () => {
    expect(canonicalAppBaseUrl({ APP_BASE_URL: "https://app.example.test/path?x=1", BETTER_AUTH_URL: "https://other.test" })).toBe("https://app.example.test");
    expect(appUrl("/install", { APP_BASE_URL: "https://app.example.test" })).toBe("https://app.example.test/install");
  });
  it("falls back to the established auth origin", () => expect(canonicalAppBaseUrl({ BETTER_AUTH_URL: "https://capture-tracker-production.example" })).toBe("https://capture-tracker-production.example"));
});
