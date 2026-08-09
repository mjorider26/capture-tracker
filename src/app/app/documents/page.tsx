import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DocumentsExperience } from "@/components/documents-experience";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { ButtonLink } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { listDocuments } from "@/lib/documents/service";
import { workspaceFailureMetadata } from "@/lib/observability/workspace-failure";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const context = await getContext();
  const cpaReadOnly = context.membership.role === "CPA_READ_ONLY";
  const policy = cpaReadOnly ? await prisma.business.findUnique({ where: { id: context.business.id }, select: { cpaDocumentAccess: true } }) : null;
  const documents = await loadDocuments(context.business.id, cpaReadOnly);
  return (
    <AppShell mode="app" destination="documents" businessName={context.business.displayName}>
      <div className="space-y-6">
        <DocumentsExperience
          documents={cpaReadOnly && !policy?.cpaDocumentAccess ? [] : documents}
          basePath="/app"
          action={!cpaReadOnly ? <ButtonLink href="#document-upload" tone="primary">Upload document</ButtonLink> : undefined}
        />
        {cpaReadOnly && !policy?.cpaDocumentAccess ? <p className="ui-card p-5 text-sm text-text-muted">The owner has not enabled CPA document access for this workspace.</p> : null}
        {!cpaReadOnly && <DocumentUploadForm />}
      </div>
    </AppShell>
  );
}

async function loadDocuments(businessId: string, cpaReadOnly = false) {
  try {
    return await listDocuments(businessId, { cpaReadOnly });
  } catch (error) {
    console.error(JSON.stringify(workspaceFailureMetadata("documents_list", error)));
    throw error;
  }
}

async function getContext() {
  try {
    return await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) notFound();
    throw error;
  }
}
