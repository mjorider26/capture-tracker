import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DocumentsExperience } from "@/components/documents-experience";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { ButtonLink } from "@/components/ui";
import { listDocuments } from "@/lib/documents/service";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const context = await getContext();
  const documents = await listDocuments(context.business.id);
  return (
    <AppShell mode="app" destination="documents" businessName={context.business.displayName}>
      <div className="space-y-6">
        <DocumentsExperience
          documents={documents}
          basePath="/app"
          action={<ButtonLink href="#document-upload" tone="primary">Upload fictional document</ButtonLink>}
        />
        <DocumentUploadForm />
      </div>
    </AppShell>
  );
}

async function getContext() {
  try {
    return await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) notFound();
    throw error;
  }
}
