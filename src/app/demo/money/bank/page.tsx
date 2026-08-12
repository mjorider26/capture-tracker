import { notFound } from "next/navigation";

import {
  chooseBankFeedMethodAction,
  disconnectPlaidConnectionAction,
  mapBankAccountAction,
  selectPlaidAccountAction,
  syncPlaidConnectionAction,
} from "@/app/app/money/bank/actions";
import { AccountingNav } from "@/components/accounting-nav";
import { AppShell } from "@/components/app-shell";
import { BankConnections } from "@/components/bank-connections";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { getBankConnectionWorkspace } from "@/lib/services/bank-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function DemoBankConnectionsPage() {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();

  return (
    <AppShell mode="demo" destination="money" businessName={context.businessName}>
      <AccountingNav basePath="/demo" active="bank" />
      <BankConnections
        {...await getBankConnectionWorkspace(context.businessId)}
        basePath="/demo"
        canManage
        mapAction={mapBankAccountAction}
        methodAction={chooseBankFeedMethodAction}
        selectionAction={selectPlaidAccountAction}
        syncAction={syncPlaidConnectionAction}
        disconnectAction={disconnectPlaidConnectionAction}
      />
    </AppShell>
  );
}
