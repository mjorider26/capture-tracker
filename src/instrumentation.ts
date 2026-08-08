import type { Instrumentation } from "next";

import { workspaceFailureMetadata } from "@/lib/observability/workspace-failure";

const workspacePath = /^\/app(?:\/[a-z-]+)?$/;

/**
 * Next captures Server Component render exceptions before route-level error
 * boundaries receive them. Keep the production signal deliberately minimal:
 * no request headers, query strings, user data, or original error message.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const pathname = request.path.split("?", 1)[0];
  if (!workspacePath.test(pathname)) return;

  const errorRecord = error as { digest?: unknown };
  const digest = typeof errorRecord.digest === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(errorRecord.digest)
    ? errorRecord.digest
    : undefined;
  const metadata = workspaceFailureMetadata("rsc_render", error);
  console.error(JSON.stringify({
    event: "workspace_render_failed",
    pathname,
    category: metadata.category,
    name: metadata.name,
    ...(metadata.code ? { code: metadata.code } : {}),
    ...(digest ? { digest } : {}),
    renderSource: context.renderSource,
    routeType: context.routeType,
  }));
};
