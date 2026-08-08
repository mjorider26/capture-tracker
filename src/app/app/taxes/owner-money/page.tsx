import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OwnerMoneyExperience } from "@/components/owner-money-experience";
import { TaxesNav } from "@/components/taxes-nav";
import { getOwnerMoneyDashboard } from "@/lib/data/owner-money";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import { classifyAuthenticatedOwnerTransfer, createAuthenticatedReimbursement } from "./actions";
export const dynamic = "force-dynamic"; export const revalidate = 0; export const metadata = { robots: { index: false, follow: false } };
async function getContext() { try { return await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } }
export default async function OwnerMoneyPage() { const context = await getContext(); return <AppShell mode="app" destination="taxes" businessName={context.business.displayName}><TaxesNav basePath="/app" /><OwnerMoneyExperience data={await getOwnerMoneyDashboard(context.business.id)} action={createAuthenticatedReimbursement} transferAction={classifyAuthenticatedOwnerTransfer} /></AppShell>; }
