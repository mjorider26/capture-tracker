import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TaxPaymentForm } from "@/components/tax-payment-form";
import { formatDate } from "@/components/taxes-experience";
import { TaxesNav } from "@/components/taxes-nav";
import { getTaxEstimateDetail } from "@/lib/data/taxes";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

import { payDemo } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function DemoEstimatePage({
  params,
}: {
  params: Promise<{ estimateId: string }>;
}) {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  const estimate = await getTaxEstimateDetail(
    context.businessId,
    (await params).estimateId,
  );
  if (!estimate) notFound();
  return (
    <AppShell
      mode="demo"
      destination="taxes"
      businessName={context.businessName}
    >
      <TaxesNav basePath="/demo" />
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
      <section className="ui-card mt-6 overflow-x-auto p-5">
        <h2 className="font-bold">Payment history</h2>
        {estimate.payments.length ? (
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
              {estimate.payments.map((payment) => (
                <tr
                  className="border-t border-border-subtle"
                  key={`${payment.recordedAt}-${payment.amount}`}
                >
                  <td className="py-3 pr-4 font-bold">Recorded payment</td>
                  <td className="py-3 pr-4">{formatDate(payment.paidAt)}</td>
                  <td className="money-value py-3 pr-4 text-right">
                    ${payment.amount}
                  </td>
                  <td className="py-3 pr-4">
                    {formatDate(payment.recordedAt)}
                  </td>
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
      <TaxPaymentForm
        estimateId={estimate.id}
        version={estimate.version}
        action={payDemo}
      />
    </AppShell>
  );
}
