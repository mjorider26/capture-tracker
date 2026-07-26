import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DocumentDetail } from "@/components/document-detail";
import { getDocument } from "@/lib/documents/service";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { transitionDemoDocument } from "../actions";
export const dynamic = "force-dynamic";
export default async function DemoDocumentPage({ params }: { params: Promise<{ documentId: string }> }) { const context = await resolveLocalDemoContext(); if (!context) notFound(); const document = await getDocument(context.businessId, (await params).documentId); if (!document) notFound(); const actions = document.status === "PENDING_VALIDATION" ? <div className="mt-5 flex gap-3"><form action={transitionDemoDocument.bind(null, document.id, "ACTIVE")}><button className="min-h-11 rounded bg-brand-teal px-3 text-sm font-bold text-white">Mark active</button></form><form action={transitionDemoDocument.bind(null, document.id, "QUARANTINED")}><button className="min-h-11 rounded border border-border-subtle px-3 text-sm font-bold">Quarantine</button></form></div> : undefined; return <AppShell mode="demo" destination="documents" businessName={context.businessName}><DocumentDetail document={document} basePath="/demo" actions={actions} /></AppShell>; }
