import { readFile } from "node:fs/promises";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const readPublicBootstrapState = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/public-bootstrap-state", () => ({ readPublicBootstrapState }));

describe("production bootstrap create page", () => {
  it("keeps successful bootstrap signup on the sign-in flow without an invitation field", async () => {
    const source = await readFile(new URL("../../components/create-account-form.tsx", import.meta.url), "utf8");

    expect(source).toContain("Your account was created. Sign in to continue.");
    expect(source).toContain('endpoint = "/api/invitations/create-account"');
    expect(source).toContain('href="/sign-in?created=1"');
    expect(source).not.toContain("invitationCode");
  });

  it("server-renders the available production form without an invitation field", async () => {
    readPublicBootstrapState.mockResolvedValue({ deploymentKind: "production", bootstrapAvailability: "available" });
    const { default: CreateAccountPage } = await import("./page");

    const html = renderToStaticMarkup(await CreateAccountPage());

    expect(html).toContain("Create the first owner account");
    expect(html).toContain('name="password"');
    expect(html).not.toMatch(/invitation.?code/i);
    expect(html).not.toMatch(/fictional staging|practice account/i);
  });

  it("fails closed for unavailable production state and preserves the staging practice flow", async () => {
    const { default: CreateAccountPage } = await import("./page");
    readPublicBootstrapState.mockResolvedValue({ deploymentKind: "production", bootstrapAvailability: "unknown" });
    expect(renderToStaticMarkup(await CreateAccountPage())).toContain("temporarily unavailable");

    readPublicBootstrapState.mockResolvedValue({ deploymentKind: "staging", bootstrapAvailability: "initialized" });
    const staging = renderToStaticMarkup(await CreateAccountPage());
    expect(staging).toContain("Create practice account");
    const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toContain('endpoint="/api/staging/create-practice-account"');
  });
});
