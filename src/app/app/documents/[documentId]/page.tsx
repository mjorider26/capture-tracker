import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DocumentDetail } from "@/components/document-detail";
import { getDocument } from "@/lib/documents/service";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
export const dynamic = "force-dynamic";
export default async function DocumentPage({ params }: { params: Promise<{ documentId: string }> }) { const context = await getContext(); const document = await getDocument(context.business.id, (await params).documentId); if (!document) notFound(); return <AppShell mode="app" destination="documents" businessName={context.business.displayName}><DocumentDetail document={document} basePath="/app" /></AppShell>; }
async function getContext() { try { return await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } }
