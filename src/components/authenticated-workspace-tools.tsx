import { requireBusinessContext } from "@/lib/security/business-context";

import { WorkspaceTools } from "./workspace-tools";

export async function AuthenticatedWorkspaceTools() {
  const context = await requireBusinessContext();
  return <WorkspaceTools basePath="/app" role={context.membership.role === "OWNER" ? "OWNER" : "CPA_READ_ONLY"} />;
}
