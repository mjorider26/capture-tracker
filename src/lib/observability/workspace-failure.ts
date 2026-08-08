export function workspaceFailureMetadata(scope: "session" | "business_context" | "today_dashboard" | "money_dashboard" | "documents_list" | "rsc_render", error: unknown) {
  const record = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  const message = typeof record?.message === "string" ? record.message : "";
  const code = typeof record?.code === "string" && /^[A-Z]\d{4}$/.test(record.code) ? record.code : undefined;
  const category = /malwareScanStatus|Document_secure_storage_state/i.test(message)
    ? "DOCUMENT_SCAN_SCHEMA"
    : /DATABASE_URL|connection string/i.test(message)
      ? "DATABASE_CONFIGURATION"
      : /authentication|session|better auth/i.test(message)
        ? "AUTHENTICATION"
        : /chunk|loading css|loading script/i.test(message)
          ? "CLIENT_ASSET"
          : /Prisma|query|column|relation|enum/i.test(message)
            ? "DATABASE_QUERY"
            : "UNCLASSIFIED";
  return {
    event: "workspace_load_failed",
    scope,
    category,
    ...(code ? { code } : {}),
    name: typeof record?.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(record.name) ? record.name : "UnknownError",
  };
}

export function workspaceClientFailureMetadata(error: unknown, pathname: string) {
  const record = error as { digest?: unknown; message?: unknown } | null;
  const message = typeof record?.message === "string" ? record.message : "";
  const category = /chunk|loading css|loading script/i.test(message)
    ? "CLIENT_ASSET"
    : /server component|rsc|flight/i.test(message)
      ? "RSC_RESPONSE"
      : /network|failed to fetch/i.test(message)
        ? "NETWORK"
        : /malwareScanStatus|Document_secure_storage_state/i.test(message)
          ? "DOCUMENT_SCAN_SCHEMA"
          : "CLIENT_RENDER";
  return {
    category,
    pathname: /^\/app(?:\/[a-z-]+)?$/.test(pathname) ? pathname : "/app",
    ...(typeof record?.digest === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(record.digest) ? { digest: record.digest } : {}),
  };
}
