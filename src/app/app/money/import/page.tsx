import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TransactionImportExperience } from "@/components/transaction-import-experience";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import { getImportWorkspace } from "@/lib/services/financial-ingestion";
export const dynamic = "force-dynamic";
export default async function ImportTransactionsPage() { const context = await getContext(); const workspace = await getImportWorkspace(context.business.id); return <AppShell mode="app" destination="money" businessName={context.business.displayName}><TransactionImportExperience {...workspace} /></AppShell>; }
async function getContext() { try { return await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } }
