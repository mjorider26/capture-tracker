import { beforeEach, describe, expect, it, vi } from "vitest";

const { readInvitationByToken, signUpEmail } = vi.hoisted(() => ({
  readInvitationByToken: vi.fn(),
  signUpEmail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  productionOwnerBootstrapAuth: { api: { signUpEmail } },
}));
vi.mock("@/lib/auth/operator-invitations", () => ({ readInvitationByToken }));

import { POST } from "./route";

const token = "a".repeat(64);
const account = {
  token,
  name: "Fictional Owner",
  email: "owner@example.test",
  password: "fictional-passphrase",
  confirmPassword: "fictional-passphrase",
};

describe("invitation account POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readInvitationByToken.mockResolvedValue({
      usable: true,
      email: account.email,
    });
    signUpEmail.mockResolvedValue(
      Response.json({ user: { id: "fictional-user" } }),
    );
  });

  it("accepts the hydrated JSON request without reflecting credentials", async () => {
    const response = await POST(
      new Request("https://capture.example/api/operator/invitations/account", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://capture.example",
        },
        body: JSON.stringify(account),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      code: "ACCOUNT_CREATED",
    });
    expect(response.url).not.toContain(account.password);
  });

  it("accepts a native form POST and redirects without credentials in the URL", async () => {
    const response = await POST(
      new Request("https://capture.example/api/operator/invitations/account", {
        method: "POST",
        headers: { origin: "https://capture.example" },
        body: new URLSearchParams(account),
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `https://capture.example/sign-in?invite=${token}&created=1`,
    );
    expect(response.headers.get("location")).not.toContain(account.password);
    expect(signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: account.email }),
      }),
    );
  });

  it("keeps the invitation email authoritative", async () => {
    const response = await POST(
      new Request("https://capture.example/api/operator/invitations/account", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://capture.example",
        },
        body: JSON.stringify({ ...account, email: "attacker@example.test" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(signUpEmail).not.toHaveBeenCalled();
  });
});
