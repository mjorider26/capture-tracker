import Link from "next/link";

import { CpaBoundary } from "./cpa-boundary";
import { Card, InlineAlert, PageHeader } from "./ui";

type TaxesData = Awaited<
  ReturnType<typeof import("@/lib/data/taxes").getTaxesDashboard>
>;

export function TaxesExperience({
  data,
  basePath,
}: {
  data: TaxesData;
  basePath: "/app" | "/demo";
}) {
  return (
    <>
      <PageHeader
        description="Recorded financial facts and review signals for tax planning."
        eyebrow="Taxes"
        title="Tax planning workspace"
      />
      <CpaBoundary />
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Projected tax obligation"
          value={data.current ? `$${data.current.projected}` : "Not available"}
        />
        <Metric
          label="Recorded payments"
          value={data.current ? `$${data.current.paid}` : "Not available"}
        />
        <Metric
          label="Quarterly estimate remaining"
          value={data.current ? `$${data.current.remaining}` : "Not available"}
        />
        <Metric
          label="YTD payroll wages"
          value={`$${data.payroll.grossWages}`}
        />
      </section>
      <div className="mt-6">
        <InlineAlert
          title={data.current?.readiness.title ?? "Not configured"}
          tone="warning"
        >
          {data.current?.readiness.detail ??
            "No current estimate, prior-year tax, withholding, or CPA method is configured."}
        </InlineAlert>
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-bold">Quarterly estimates</h2>
        {data.estimates.length ? (
          data.estimates.map((estimate) => (
            <Link
              className="mt-3 flex min-h-11 items-center justify-between gap-4 border-t border-border-subtle pt-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
              href={`${basePath}/taxes/estimates/${estimate.id}`}
              key={estimate.id}
            >
              <span>
                Q{estimate.quarter} {estimate.taxYear} · {estimate.jurisdiction}
              </span>
              <span className="money-value font-bold">
                ${estimate.remaining} remaining
              </span>
            </Link>
          ))
        ) : (
          <p className="mt-3 text-sm text-text-muted">
            No estimates are recorded.
          </p>
        )}
      </Card>
    </>
  );
}

export function PayrollExperience({ data }: { data: TaxesData }) {
  const payroll = data.payroll;
  return (
    <>
      <PageHeader
        description="Processed payroll records only. Capture Tracker does not process payroll."
        eyebrow="Taxes"
        title="Payroll summary"
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="YTD gross wages" value={`$${payroll.grossWages}`} />
        <Metric label="YTD withholding" value={`$${payroll.withholding}`} />
        <Metric
          label="Employer payroll taxes"
          value={`$${payroll.employerPayrollTaxes}`}
        />
        <Metric label="YTD net pay" value={`$${payroll.netPay}`} />
      </section>
      <Card className="mt-6 overflow-x-auto p-5">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="font-bold">Processed payroll runs</h2>
          <p className="text-sm text-text-muted">
            {payroll.count} run{payroll.count === 1 ? "" : "s"} · Latest{" "}
            {formatDate(payroll.latestDate)}
          </p>
        </div>
        {payroll.runs.length ? (
          <table className="mt-4 min-w-[680px] w-full text-left text-sm">
            <thead className="text-text-muted">
              <tr>
                <th className="pb-2 pr-4">Pay date</th>
                <th className="pb-2 pr-4">Pay period</th>
                <th className="pb-2 pr-4 text-right">Gross wages</th>
                <th className="pb-2 pr-4 text-right">Withholding</th>
                <th className="pb-2 pr-4 text-right">Employer taxes</th>
                <th className="pb-2 text-right">Net pay</th>
              </tr>
            </thead>
            <tbody>
              {payroll.runs.map((run) => (
                <tr className="border-t border-border-subtle" key={run.id}>
                  <td className="py-3 pr-4">{formatDate(run.payDate)}</td>
                  <td className="py-3 pr-4">
                    {formatDate(run.payPeriodStart)} –{" "}
                    {formatDate(run.payPeriodEnd)}
                  </td>
                  <MoneyCell value={run.grossWages} />
                  <MoneyCell value={run.withholding} />
                  <MoneyCell value={run.employerPayrollTaxes} />
                  <MoneyCell value={run.netPay} />
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-text-muted">
            No processed payroll runs are recorded.
          </p>
        )}
      </Card>
    </>
  );
}

export function OwnerCompensationExperience({ data }: { data: TaxesData }) {
  const owner = data.ownerCompensation;
  return (
    <>
      <CpaBoundary />
      <PageHeader
        description="Factual payroll and distribution history for CPA review; not a compensation conclusion."
        eyebrow="Taxes"
        title="Owner compensation"
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="YTD payroll wages" value={`$${owner.payrollWages}`} />
        <Metric
          label="YTD owner distributions"
          value={`$${owner.distributions}`}
        />
        <Metric
          label="Combined owner cash received"
          value={`$${owner.combinedCash}`}
        />
      </section>
      <Card className="mt-6 p-5">
        <h2 className="font-bold">Factual review signals</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <Fact label="Payroll runs" value={`${owner.payrollRunCount}`} />
          <Fact label="Distributions" value={`${owner.distributionCount}`} />
          <Fact
            label="Latest payroll date"
            value={formatDate(owner.latestPayrollDate)}
          />
          <Fact
            label="Latest distribution date"
            value={formatDate(owner.latestDistributionDate)}
          />
        </dl>
      </Card>
      <InlineAlert title="Missing facts for CPA review" tone="warning">
        {owner.missingFacts} Distributions are equity movements, not deductible
        expenses.
      </InlineAlert>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-bold text-text-muted">{label}</p>
      <p className="money-value mt-3 text-2xl font-bold text-brand-navy">
        {value}
      </p>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-text-muted">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

function MoneyCell({ value }: { value: string }) {
  return <td className="money-value py-3 pr-4 text-right">${value}</td>;
}

export function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}
