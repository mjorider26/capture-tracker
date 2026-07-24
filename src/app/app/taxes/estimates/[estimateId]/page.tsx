import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TaxPaymentForm } from "@/components/tax-payment-form";
import { formatDate } from "@/components/taxes-experience";
import { TaxesNav } from "@/components/taxes-nav";
import { getTaxEstimateDetail } from "@/lib/data/taxes";
import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";

import { payApp } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

async function getContext() {
  try {
    return await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) notFound();
    throw error;
  }
}

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ estimateId: string }>;
}) {
  const context = await getContext();
  const estimate = await getTaxEstimateDetail(
    context.business.id,
    (await params).estimateId,
  );
  if (!estimate) notFound();
  return (
    <AppShell
      mode="app"
      destination="taxes"
      businessName={context.business.displayName}
    >
      <TaxesNav basePath="/app" />
      <EstimateDetail estimate={estimate} action={payApp} />
    </AppShell>
  );
}

function EstimateDetail({
  estimate,
  action,
}: {
  estimate: NonNullable<Awaited<ReturnType<typeof getTaxEstimateDetail>>>;
  action: typeof payApp;
}) {
  return (
    <>
      <h1 className="text-3xl font-bold">
        Q{estimate.quarter} {estimate.taxYear} estimate
      </h1>
      <p className="money-value mt-2 text-lg">
        ${estimate.projected} projected · ${estimate.paid} paid · $
        {estimate.remaining} remaining
      </p>
      <p className="mt-3 text-sm text-text-muted">
        Recorded externally; no payment was initiated by Capture Tracker.
      </p>
      <PaymentHistory payments={estimate.payments} />
      <TaxPaymentForm
        estimateId={estimate.id}
        version={estimate.version}
        action={action}
      />
    </>
  );
}

function PaymentHistory({
  payments,
}: {
  payments: NonNullable<
    Awaited<ReturnType<typeof getTaxEstimateDetail>>
  >["payments"];
}) {
  return (
    <section className="ui-card mt-6 overflow-x-auto p-5">
      <h2 className="font-bold">Payment history</h2>
      {payments.length ? (
        <table className="mt-4 min-w-[560px] w-full text-left text-sm">
          <thead className="text-text-muted">
            <tr>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Payment date</th>
              <th className="pb-2 pr-4 text-right">Exact amount</th>
              <th className="pb-2 pr-4">Recorded</th>
              <th className="pb-2">Reference or note</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr
                className="border-t border-border-subtle"
                key={`${payment.recordedAt}-${payment.amount}`}
              >
                <td className="py-3 pr-4 font-bold">Recorded payment</td>
                <td className="py-3 pr-4">{formatDate(payment.paidAt)}</td>
                <td className="money-value py-3 pr-4 text-right">
                  ${payment.amount}
                </td>
                <td className="py-3 pr-4">{formatDate(payment.recordedAt)}</td>
                <td className="py-3">
                  {payment.reference ?? "No reference recorded"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-sm text-text-muted">
          No payments have been recorded.
        </p>
      )}
    </section>
  );
}
