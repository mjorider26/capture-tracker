import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TransactionDetailExperience } from "@/components/transaction-detail-experience";
import { getTransactionDetailForBusiness } from "@/lib/data/transaction-detail";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

import { reviewDemoTransaction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function DemoTransactionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  const detail = await getTransactionDetailForBusiness(
    context.businessId,
    (await params).transactionId,
  );
  if (!detail) notFound();
  return (
    <AppShell
      mode="demo"
      destination="money"
      businessName={context.businessName}
    >
      <TransactionDetailExperience
        detail={detail}
        basePath="/demo"
        action={reviewDemoTransaction}
      />
    </AppShell>
  );
}
