import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ManualTransactionForm } from "@/components/manual-transaction-form";
import { getManualTransactionEntryOptions } from "@/lib/data/manual-transaction-entry";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

import { createDemoManualTransaction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewDemoManualTransactionPage() {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  return <AppShell mode="demo" destination="money" businessName={context.businessName}><ManualTransactionForm options={await getManualTransactionEntryOptions(context.businessId)} basePath="/demo" action={createDemoManualTransaction} /></AppShell>;
}
