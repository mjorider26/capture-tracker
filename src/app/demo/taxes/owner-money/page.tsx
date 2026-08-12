import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OwnerMoneyExperience } from "@/components/owner-money-experience";
import { TaxesNav } from "@/components/taxes-nav";
import { getOwnerMoneyDashboard } from "@/lib/data/owner-money";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { approveDemoReimbursement, classifyDemoOwnerTransfer, createDemoReimbursement, matchDemoReimbursementPayment } from "./actions";
export const dynamic = "force-dynamic"; export const revalidate = 0; export const metadata = { robots: { index: false, follow: false } };
export default async function DemoOwnerMoneyPage() { const context = await resolveLocalDemoContext(); if (!context) notFound(); return <AppShell mode="demo" destination="taxes" businessName={context.businessName}><TaxesNav basePath="/demo" /><OwnerMoneyExperience data={await getOwnerMoneyDashboard(context.businessId)} action={createDemoReimbursement} transferAction={classifyDemoOwnerTransfer} approveAction={approveDemoReimbursement} paymentAction={matchDemoReimbursementPayment} sCorpHref="/demo/taxes/owner-money/s-corp" basePath="/demo" /></AppShell>; }
