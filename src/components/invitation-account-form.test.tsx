import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { InvitationAccountForm } from "./invitation-account-form";

describe("invitation account creation", () => {
  it("binds the invited email, explains recovery, and never asks for financial data", () => {
    const html = renderToStaticMarkup(
      <InvitationAccountForm
        token="private-token"
        businessDisplayName="Fictional Studio"
        email="owner@example.test"
      />,
    );
    expect(html).toContain("Create your Capture Tracker account");
    expect(html).toContain("owner@example.test");
    expect(html).toContain("readOnly");
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/operator/invitations/account"');
    expect(html).toContain("Already have an account? Sign in");
    expect(html).not.toContain("bank password");
    expect(html).not.toContain("account number");
  });
});
