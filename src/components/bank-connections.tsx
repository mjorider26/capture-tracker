"use client";

import Link from "next/link";
import { useActionState } from "react";
import { InlineAlert, PageHeader, StatusBadge } from "./ui";
import type { BankConnectionActionState } from "@/app/app/money/bank/actions";

type Props = {
  liveProviderConfigured: boolean;
  canManage: boolean;
  accounts: Array<{ id: string; name: string }>;
  connections: Array<{ id: string; institutionName: string | null; state: string; lastAttemptedSyncAt: string | null; lastSuccessfulSyncAt: string | null; lastRun: { status: string; imported: number; duplicates: number; error: string | null } | null; accounts: Array<{ id: string; name: string; type: string; lastFour: string | null; financialAccountId: string | null; financialAccountName: string | null }> }>;
  mapAction: (state: BankConnectionActionState, form: FormData) => Promise<BankConnectionActionState>;
};
const initial: BankConnectionActionState = { ok: false };
const stamp = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not yet";
const tone = (state: string) => (state === "CONNECTED" || state === "COMPLETED" ? "success" : state === "SYNCING" ? "info" : "warning") as "success" | "info" | "warning";

export function BankConnections({ liveProviderConfigured, canManage, accounts, connections, mapAction }: Props) {
  const [state, action] = useActionState(mapAction, initial);
  return <section className="space-y-6"><PageHeader eyebrow="Money / bank" title="Bank connections" description="Connected financial activity is evidence for review, never an automatic accounting decision." action={<Link href="/app/money/import" className="ui-button ui-button-secondary min-h-11 border border-border-subtle px-4 pt-3 text-sm font-bold">Import a CSV instead</Link>}/>
    {!liveProviderConfigured && <InlineAlert title="LIVE BANK PROVIDER NOT CONFIGURED" tone="warning">No live bank provider is active for this workspace. CSV import remains available and first-class; Capture Tracker will not simulate a connection or expose a test provider here.</InlineAlert>}
    {!canManage && <InlineAlert title="Professional review" tone="info">This is read-only professional access. Connection changes and account mappings remain owner decisions.</InlineAlert>}
    {connections.length ? <div className="space-y-4">{connections.map((connection) => <section key={connection.id} className="ui-card overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle p-5"><div><h2 className="font-bold">{connection.institutionName ?? "Financial institution"}</h2><p className="mt-1 text-sm text-text-muted">Last attempted: {stamp(connection.lastAttemptedSyncAt)} · Last successful: {stamp(connection.lastSuccessfulSyncAt)}</p></div><StatusBadge tone={tone(connection.state)}>{connection.state.replaceAll("_", " ")}</StatusBadge></div><div className="divide-y divide-border-subtle">{connection.accounts.map((account) => <article key={account.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_auto]"><div><p className="font-bold">{account.name}</p><p className="mt-1 text-sm text-text-muted">{account.type.replaceAll("_", " ").toLowerCase()}{account.lastFour ? ` · •••• ${account.lastFour}` : ""}</p><p className="mt-2 text-sm text-text-muted">{account.financialAccountName ? `Mapped to ${account.financialAccountName}` : "Needs a Capture Tracker financial-account mapping before any activity can enter review."}</p></div>{canManage && <form action={action} className="flex min-w-0 flex-wrap items-center gap-2"><input type="hidden" name="connectedAccountId" value={account.id}/><select name="financialAccountId" defaultValue={account.financialAccountId ?? ""} className="ui-input min-h-11 min-w-52"><option value="">No mapping</option>{accounts.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select><button className="ui-button ui-button-secondary min-h-11 border border-border-subtle px-3 text-sm font-bold">Save mapping</button></form>}</article>)}</div>{connection.lastRun && <p className="border-t border-border-subtle p-4 text-xs text-text-muted">Last sync: {connection.lastRun.status.toLowerCase()} · {connection.lastRun.imported} imported · {connection.lastRun.duplicates} duplicate{connection.lastRun.error ? ` · ${connection.lastRun.error}` : ""}</p>}</section>)}</div> : <section className="ui-card p-6"><h2 className="font-bold">No connected financial institutions</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">A live provider has not been configured, so there is nothing to connect from this product surface. Use CSV import to bring activity into the same controlled review queue.</p></section>}
    {state.message && <InlineAlert title={state.ok ? "Mapping saved" : "Mapping unavailable"} tone={state.ok ? "success" : "warning"}>{state.message}</InlineAlert>}
  </section>;
}
