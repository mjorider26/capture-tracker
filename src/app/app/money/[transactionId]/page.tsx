import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TransactionDetailExperience } from "@/components/transaction-detail-experience";
import { getTransactionDetailForBusiness } from "@/lib/data/transaction-detail";
import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";

import { reviewAuthenticatedTransaction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function ApplicationTransactionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const context = await getContext();
  const detail = await getTransactionDetailForBusiness(
    context.business.id,
    (await params).transactionId,
  );
  if (!detail) notFound();
  return (
    <AppShell
      mode="app"
      destination="money"
      businessName={context.business.displayName}
    >
      <TransactionDetailExperience
        detail={detail}
        basePath="/app"
        action={reviewAuthenticatedTransaction}
      />
    </AppShell>
  );
}

async function getContext() {
  try {
    return await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) notFound();
    throw error;
  }
}
