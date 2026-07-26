import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DocumentsExperience } from "@/components/documents-experience";
import { listDocuments } from "@/lib/documents/service";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

import { createDemoDocuments } from "./actions";

export const dynamic = "force-dynamic";

export default async function DemoDocumentsPage() {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  const documents = await listDocuments(context.businessId);

  return (
    <AppShell mode="demo" destination="documents" businessName={context.businessName}>
      <DocumentsExperience
        documents={documents}
        basePath="/demo"
        action={
          <form action={createDemoDocuments}>
            <button className="min-h-11 rounded-[var(--radius-sm)] bg-brand-teal px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--brand-teal-strong)]">
              Create demo documents
            </button>
          </form>
        }
      />
    </AppShell>
  );
}
