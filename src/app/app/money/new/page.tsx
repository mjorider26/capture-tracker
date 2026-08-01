import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ManualTransactionForm } from "@/components/manual-transaction-form";
import { getManualTransactionEntryOptions } from "@/lib/data/manual-transaction-entry";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

import { createAuthenticatedManualTransaction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewManualTransactionPage() {
  const context = await getContext();
  return <AppShell mode="app" destination="money" businessName={context.business.displayName}><ManualTransactionForm options={await getManualTransactionEntryOptions(context.business.id)} basePath="/app" action={createAuthenticatedManualTransaction} /></AppShell>;
}

async function getContext() {
  try { return await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; }
}
