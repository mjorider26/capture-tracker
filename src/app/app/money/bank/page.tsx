import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AccountingNav } from "@/components/accounting-nav";
import { BankConnections } from "@/components/bank-connections";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import { getBankConnectionWorkspace } from "@/lib/services/bank-sync";
import { mapBankAccountAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BankConnectionsPage() {
  let context;
  try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; }
  const workspace = await getBankConnectionWorkspace(context.business.id);
  return <AppShell mode="app" destination="money" businessName={context.business.displayName}><AccountingNav basePath="/app" active="bank"/><BankConnections {...workspace} canManage={context.membership.role === "OWNER"} mapAction={mapBankAccountAction}/></AppShell>;
}
