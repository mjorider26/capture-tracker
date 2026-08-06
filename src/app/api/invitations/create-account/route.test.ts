import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signUpEmail: vi.fn() }));
const bootstrap = vi.hoisted(() => ({ acquire: vi.fn(), ready: vi.fn(), canResume: vi.fn(), provision: vi.fn() }));
const core = vi.hoisted(() => ({ validate: vi.fn(), hash: vi.fn() }));
const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, account: { findFirst: vi.fn() } }));

vi.mock("@/lib/auth", () => ({ productionOwnerBootstrapAuth: { api: auth } }));
vi.mock("@/lib/auth/production-owner-bootstrap", () => ({ acquireProductionOwnerBootstrap: bootstrap.acquire, isProductionWorkspaceReady: bootstrap.ready, productionBootstrapCanResume: bootstrap.canResume, provisionProductionWorkspace: bootstrap.provision }));
vi.mock("@/lib/auth/production-owner-bootstrap-core", () => ({ productionBootstrapError: "Account creation could not be completed.", validateProductionBootstrapInput: core.validate, productionBootstrapEmailHash: core.hash }));
vi.mock("@/lib/auth/workerd-password", () => ({ verifyWorkerdPassword: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma }));

const input = { name: "Owner", email: "owner@example.test", password: "correct-horse-battery-staple", confirmPassword: "correct-horse-battery-staple" };
const request = () => new Request("https://capture-tracker.example.test/api/invitations/create-account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });

describe("production first-owner bootstrap route", () => {
  beforeEach(() => { auth.signUpEmail.mockReset(); bootstrap.acquire.mockReset(); bootstrap.ready.mockReset(); bootstrap.canResume.mockReset(); bootstrap.provision.mockReset(); core.validate.mockReset(); core.hash.mockReset(); prisma.user.findUnique.mockReset(); prisma.account.findFirst.mockReset(); core.validate.mockReturnValue(input); core.hash.mockReturnValue("email-hash"); bootstrap.acquire.mockResolvedValue({ ownerEmailHash: "email-hash", userId: null }); bootstrap.canResume.mockResolvedValue(true); bootstrap.ready.mockResolvedValue(false); prisma.user.findUnique.mockResolvedValue(null); });
  it("creates and provisions the single owner without an invitation", async () => { auth.signUpEmail.mockResolvedValue(new Response(JSON.stringify({ user: { id: "owner" } }), { status: 200 })); const { POST } = await import("./route"); const response = await POST(request()); await expect(response.json()).resolves.toEqual({ ok: true, code: "ACCOUNT_CREATED" }); expect(auth.signUpEmail).toHaveBeenCalledWith(expect.objectContaining({ body: { name: input.name, email: input.email, password: input.password } })); expect(bootstrap.provision).toHaveBeenCalledWith({ userId: "owner", displayName: "Owner", ownerEmailHash: "email-hash" }); });
  it("rejects a second or concurrent bootstrap lease before identity creation", async () => { bootstrap.acquire.mockResolvedValue(null); const { POST } = await import("./route"); const response = await POST(request()); expect(response.status).toBe(403); expect(auth.signUpEmail).not.toHaveBeenCalled(); });
});
