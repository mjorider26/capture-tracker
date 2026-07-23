import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { BrandIcon, BrandLockup } from "@/components/brand";
import {
  Card,
  EmptyState,
  InlineAlert,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export default async function DesignSystemPage() {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  return (
    <AppShell
      mode="demo"
      destination={null}
      businessName={context.businessName}
    >
      <PageHeader
        eyebrow="Internal preview"
        title="Capture Tracker design system"
        description="Local-only reference for the shared product language. It contains no financial mutations or customer data."
      />
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-bold">Official logo assets</h2>
          <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_10rem]">
            <BrandLockup className="max-w-xl" />
            <div className="flex items-center justify-center rounded-[var(--radius-md)] bg-surface-secondary p-5">
              <BrandIcon className="h-28" />
            </div>
          </div>
        </Card>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Swatch name="Brand navy" color="#082B4D" />
          <Swatch name="Brand teal" color="#078C87" />
          <Swatch name="Teal soft" color="#E5F6F3" />
          <Swatch name="Page surface" color="#F5F7F5" />
        </section>
        <Card className="p-6">
          <h2 className="text-lg font-bold">Actions and status</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-4 text-sm font-bold text-white">
              Primary action
            </button>
            <button className="min-h-11 rounded-[var(--radius-sm)] border border-border-subtle px-4 text-sm font-bold text-brand-navy">
              Secondary
            </button>
            <button
              disabled
              className="min-h-11 rounded-[var(--radius-sm)] bg-surface-secondary px-4 text-sm font-bold text-[var(--text-subtle)]"
            >
              Disabled
            </button>
            <StatusBadge tone="warning">Awaiting review</StatusBadge>
            <StatusBadge tone="success">Business reviewed</StatusBadge>
            <StatusBadge tone="locked">Posted and locked</StatusBadge>
          </div>
        </Card>
        <section className="grid gap-4 lg:grid-cols-3">
          <InlineAlert tone="success" title="Saved successfully">
            This confirmation uses text and color, not color alone.
          </InlineAlert>
          <InlineAlert tone="warning" title="Validation needed">
            Split totals must equal the parent amount exactly.
          </InlineAlert>
          <InlineAlert tone="locked" title="Locked record">
            Posted accounting remains read-only.
          </InlineAlert>
        </section>
        <EmptyState title="No transactions match">
          Try clearing a filter or choose another account. This is the shared
          empty-state pattern for future modules.
        </EmptyState>
        <Card className="p-6">
          <h2 className="text-lg font-bold">Type and financial values</h2>
          <p className="mt-2 text-sm text-text-muted">
            Page titles use restrained display sizing; supporting text remains
            legible and calm.
          </p>
          <p className="money-value mt-4 text-3xl font-bold text-brand-navy">
            $3,550.00
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
function Swatch({ name, color }: { name: string; color: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-12" style={{ background: color }} />
      <div className="p-4">
        <p className="text-sm font-bold">{name}</p>
        <p className="mt-1 font-mono text-xs text-text-muted">{color}</p>
      </div>
    </Card>
  );
}
