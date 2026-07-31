import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  signInEmail: vi.fn(),
}));
const validatePracticeAccountInput = vi.hoisted(() => vi.fn());
const provisionPracticeWorkspace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  stagingPracticeAccountAuth: { api: auth },
}));
vi.mock("@/lib/auth/staging-practice-account-core", () => ({
  practiceAccountError: "Account creation could not be completed.",
  validatePracticeAccountInput,
}));
vi.mock("@/lib/auth/staging-practice-account", () => ({
  PracticeWorkspaceProvisionError: class PracticeWorkspaceProvisionError extends Error {},
  provisionPracticeWorkspace,
}));

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
  return new Response(
    userId ? JSON.stringify({ user: { id: userId } }) : JSON.stringify({}),
    { status },
  );
}

describe("practice-account route", () => {
  beforeEach(() => {
    auth.signUpEmail.mockReset();
    auth.signInEmail.mockReset();
    validatePracticeAccountInput.mockReset();
    provisionPracticeWorkspace.mockReset();
  });

  it("returns a generic failure before identity creation when invitation validation fails", async () => {
    validatePracticeAccountInput.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Account creation could not be completed.",
    });
    expect(auth.signUpEmail).not.toHaveBeenCalled();
  });

  it("creates one Better Auth identity and provisions its workspace", async () => {
    validatePracticeAccountInput.mockResolvedValue(acceptedInput);
    auth.signUpEmail.mockResolvedValue(authResponse(200, "identity-one"));
    provisionPracticeWorkspace.mockResolvedValue(undefined);
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.ok).toBe(true);
    expect(auth.signUpEmail).toHaveBeenCalledTimes(1);
    expect(auth.signInEmail).not.toHaveBeenCalled();
    expect(provisionPracticeWorkspace).toHaveBeenCalledWith({
      userId: "identity-one",
      displayName: "Practice Owner",
    });
  });

  it("authenticates the existing identity so a retry can finish provisioning", async () => {
    validatePracticeAccountInput.mockResolvedValue(acceptedInput);
    auth.signUpEmail.mockResolvedValue(authResponse(422));
    auth.signInEmail.mockResolvedValue(authResponse(200, "identity-one"));
    provisionPracticeWorkspace.mockResolvedValue(undefined);
    const { POST } = await import("./route");

    await expect(POST(request())).resolves.toMatchObject({ ok: true });
    expect(auth.signUpEmail).toHaveBeenCalledTimes(1);
    expect(auth.signInEmail).toHaveBeenCalledTimes(1);
    expect(provisionPracticeWorkspace).toHaveBeenCalledWith({
      userId: "identity-one",
      displayName: "Practice Owner",
    });
  });

  it("handles Better Auth's in-process duplicate-identity error shape", async () => {
    validatePracticeAccountInput.mockResolvedValue(acceptedInput);
    auth.signUpEmail.mockResolvedValue({ statusCode: 422 });
    auth.signInEmail.mockResolvedValue(authResponse(200, "identity-one"));
    provisionPracticeWorkspace.mockResolvedValue(undefined);
    const { POST } = await import("./route");

    await expect(POST(request())).resolves.toMatchObject({ ok: true });
    expect(auth.signInEmail).toHaveBeenCalledTimes(1);
    expect(provisionPracticeWorkspace).toHaveBeenCalledWith({
      userId: "identity-one",
      displayName: "Practice Owner",
    });
  });
});
