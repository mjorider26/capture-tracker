import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signUpEmail: vi.fn() }));
const validatePracticeAccountInput = vi.hoisted(() => vi.fn());
const provisionPracticeWorkspace = vi.hoisted(() => vi.fn());
const isPracticeWorkspaceReady = vi.hoisted(() => vi.fn());
const verifyWorkerdPassword = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  account: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ stagingPracticeAccountAuth: { api: auth } }));
vi.mock("@/lib/auth/staging-practice-account-core", () => ({
  practiceAccountError: "Account creation could not be completed.",
  validatePracticeAccountInput,
}));
vi.mock("@/lib/auth/staging-practice-account", () => ({
  PracticeWorkspaceProvisionError: class PracticeWorkspaceProvisionError extends Error {},
  isPracticeWorkspaceReady,
  provisionPracticeWorkspace,
}));
vi.mock("@/lib/auth/workerd-password", () => ({ verifyWorkerdPassword }));
vi.mock("@/lib/prisma", () => ({ prisma }));

const acceptedInput = {
  name: "Practice Owner",
  email: "practice.owner@example.test",
  password: "correct-horse-battery-staple",
  confirmPassword: "correct-horse-battery-staple",
  invitationCode: "submitted-fixture-code",
};

function request() {
  return new Request("https://capture-tracker.example.test/api/staging/create-practice-account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(acceptedInput),
  });
}

function authResponse(status: number, userId?: string) {
  return new Response(userId ? JSON.stringify({ user: { id: userId } }) : JSON.stringify({}), { status });
}

describe("practice-account route", () => {
  beforeEach(() => {
    auth.signUpEmail.mockReset();
    validatePracticeAccountInput.mockReset();
    provisionPracticeWorkspace.mockReset();
    isPracticeWorkspaceReady.mockReset();
    verifyWorkerdPassword.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.account.findFirst.mockReset();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.account.findFirst.mockResolvedValue({ password: "stored-hash" });
    verifyWorkerdPassword.mockResolvedValue(true);
    isPracticeWorkspaceReady.mockResolvedValue(true);
  });

  it("returns a generic failure before identity creation when invitation validation fails", async () => {
    validatePracticeAccountInput.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "Account creation could not be completed." });
    expect(auth.signUpEmail).not.toHaveBeenCalled();
  });

  it("creates one Better Auth identity and provisions its workspace", async () => {
    validatePracticeAccountInput.mockResolvedValue(acceptedInput);
    auth.signUpEmail.mockResolvedValue(authResponse(200, "identity-one"));
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toEqual({ ok: true, code: "ACCOUNT_CREATED" });
    expect(response.headers.getSetCookie?.() ?? []).toEqual([]);
    expect(auth.signUpEmail).toHaveBeenCalledTimes(1);
    expect(provisionPracticeWorkspace).toHaveBeenCalledWith({ userId: "identity-one", displayName: "Practice Owner" });
  });

  it("returns account-ready for a complete identity without a session or nested sign-in", async () => {
    validatePracticeAccountInput.mockResolvedValue(acceptedInput);
    prisma.user.findUnique.mockResolvedValue({ id: "identity-one" });
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, code: "ACCOUNT_ALREADY_READY" });
    expect(response.headers.getSetCookie?.() ?? []).toEqual([]);
    expect(auth.signUpEmail).not.toHaveBeenCalled();
    expect(verifyWorkerdPassword).toHaveBeenCalledWith("stored-hash", acceptedInput.password);
    expect(provisionPracticeWorkspace).not.toHaveBeenCalled();
  });

  it("finishes incomplete provisioning after a valid duplicate submission without a session", async () => {
    validatePracticeAccountInput.mockResolvedValue(acceptedInput);
    prisma.user.findUnique.mockResolvedValue({ id: "identity-one" });
    isPracticeWorkspaceReady.mockResolvedValue(false);
    const { POST } = await import("./route");

    const response = await POST(request());

    await expect(response.json()).resolves.toEqual({ ok: true, code: "ACCOUNT_ALREADY_READY" });
    expect(provisionPracticeWorkspace).toHaveBeenCalledWith({ userId: "identity-one", displayName: "Practice Owner" });
    expect(response.headers.getSetCookie?.() ?? []).toEqual([]);
  });

  it("handles Better Auth's in-process duplicate identity result without signing in", async () => {
    validatePracticeAccountInput.mockResolvedValue(acceptedInput);
    auth.signUpEmail.mockResolvedValue({ statusCode: 422 });
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "identity-one" });
    const { POST } = await import("./route");

    const response = await POST(request());

    await expect(response.json()).resolves.toEqual({ ok: true, code: "ACCOUNT_ALREADY_READY" });
    expect(auth.signUpEmail).toHaveBeenCalledTimes(1);
    expect(provisionPracticeWorkspace).not.toHaveBeenCalled();
  });

  it("fails generically for a wrong existing password without creating or changing anything", async () => {
    validatePracticeAccountInput.mockResolvedValue(acceptedInput);
    prisma.user.findUnique.mockResolvedValue({ id: "identity-one" });
    verifyWorkerdPassword.mockResolvedValue(false);
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "Account creation could not be completed." });
    expect(auth.signUpEmail).not.toHaveBeenCalled();
    expect(provisionPracticeWorkspace).not.toHaveBeenCalled();
  });
});
