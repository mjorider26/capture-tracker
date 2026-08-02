export const productionAcceptance = {
  email: "fictional-production-acceptance@capturetracker.invalid",
  displayName: "Fictional Production Acceptance",
  businessName: "Fictional Production Acceptance's fictional practice business",
  confirmation: "DELETE_RESERVED_FICTIONAL_PRODUCTION_ACCEPTANCE",
  authorization: "CAPTURE_TRACKER_RESERVED_FICTIONAL_ACCEPTANCE_CLEANUP",
  database: "capture_tracker_production",
  bucket: "capture-tracker-production-documents",
  backupBucket: "capture-tracker-production-backups",
} as const;

export type CleanupEnvironment = Record<string, string | undefined>;

export function reservedBusinessId(userId: string) {
  return `practice-${userId}`;
}

export function reservedR2Prefix(businessId: string) {
  return `active/${businessId}/`;
}

export function cleanupRefusal(environment: CleanupEnvironment) {
  if (environment.CAPTURE_TRACKER_ENVIRONMENT !== "production") return "ENVIRONMENT_REFUSED";
  if (environment.CAPTURE_TRACKER_EXECUTION_CONTEXT !== "cloudflare") return "EXECUTION_CONTEXT_REFUSED";
  if (environment.CAPTURE_TRACKER_DEPLOYMENT_PROFILE !== "production-cloudflare-neon") return "PROFILE_REFUSED";
  if (environment.CAPTURE_TRACKER_DATA_MODE !== "fictional") return "DATA_MODE_REFUSED";
  if (environment.CAPTURE_TRACKER_REAL_DATA_APPROVED !== "false") return "REAL_DATA_REFUSED";
  if (environment.CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED !== "false") return "ONBOARDING_REFUSED";
  if (environment.CAPTURE_TRACKER_PRODUCTION_DATABASE_NAME !== productionAcceptance.database) return "DATABASE_NAME_REFUSED";
  if (environment.CAPTURE_TRACKER_PRODUCTION_DOCUMENT_BUCKET !== productionAcceptance.bucket) return "R2_BUCKET_REFUSED";
  if (environment.CAPTURE_TRACKER_CLEANUP_AUTHORIZATION !== productionAcceptance.authorization) return "AUTHORIZATION_REFUSED";
  return null;
}

export function assertCleanupEnvironment(environment: CleanupEnvironment) {
  const refusal = cleanupRefusal(environment);
  if (refusal) throw new Error(refusal);
}

export function assertDirectProductionUrl(value: string | undefined) {
  if (!value) throw new Error("DIRECT_DATABASE_URL_REQUIRED");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("DIRECT_DATABASE_URL_INVALID"); }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error("DIRECT_DATABASE_URL_PROTOCOL_REFUSED");
  if (database !== productionAcceptance.database) throw new Error("DIRECT_DATABASE_URL_DATABASE_REFUSED");
  if (!/\.neon\.tech$/i.test(url.hostname) || /-pooler/i.test(url.hostname)) throw new Error("DIRECT_DATABASE_URL_HOST_REFUSED");
  if (url.searchParams.get("sslmode") !== "require") throw new Error("DIRECT_DATABASE_URL_TLS_REFUSED");
  return url;
}

export function assertExecutionIntent(args: string[]) {
  const execute = args.includes("--execute");
  const confirmation = args.find((value) => value.startsWith("--confirm="))?.slice("--confirm=".length);
  if (execute && confirmation !== productionAcceptance.confirmation) throw new Error("CONFIRMATION_REFUSED");
  if (!execute && confirmation) throw new Error("CONFIRMATION_REQUIRES_EXECUTE");
  return execute;
}

export function assertTenantIdentity(input: {
  user: { id: string; email: string; displayName: string } | null;
  business: { id: string; legalName: string; displayName: string } | null;
  memberships: Array<{ businessId: string }>;
}) {
  if (!input.user || input.user.email !== productionAcceptance.email || input.user.displayName !== productionAcceptance.displayName) throw new Error("RESERVED_USER_REFUSED");
  const expectedBusinessId = reservedBusinessId(input.user.id);
  if (!input.business || input.business.id !== expectedBusinessId || input.business.legalName !== productionAcceptance.businessName || input.business.displayName !== productionAcceptance.businessName) throw new Error("RESERVED_BUSINESS_REFUSED");
  if (input.memberships.length !== 1 || input.memberships[0]?.businessId !== expectedBusinessId) throw new Error("CROSS_TENANT_MEMBERSHIP_REFUSED");
  return { userId: input.user.id, businessId: expectedBusinessId };
}
