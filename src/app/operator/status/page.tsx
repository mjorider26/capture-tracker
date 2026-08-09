import { notFound } from "next/navigation";

import { OperatorStatusPanel } from "@/components/operator-status-panel";
import { appBuildId } from "@/lib/app-version";
import { OperatorAuthorizationError, requireOperatorSession } from "@/lib/auth/operator-authorization";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function OperatorStatusPage() {
  const status = await loadStatus();
  return <OperatorStatusPanel {...status} />;
}

async function loadStatus() {
  try {
    await requireOperatorSession();
    const groups = await prisma.operatorInvitation.groupBy({ by: ["status"], _count: { _all: true } });
    const migrationRows = await prisma.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM "_prisma_migrations"`;
    const count = (status: string) => groups.find((group) => group.status === status)?._count._all ?? 0;
    return { build: appBuildId(), database: "Connected" as const, migrations: migrationRows[0]?.count === 24 ? "Current" as const : "Mismatch" as const, email: "Not configured" as const, invitations: { pending: count("PENDING"), accepted: count("ACCEPTED"), expired: count("EXPIRED") } };
  } catch (error) {
    if (error instanceof OperatorAuthorizationError) notFound();
    return { build: appBuildId(), database: "Unavailable" as const, migrations: "Unavailable" as const, email: "Not configured" as const, invitations: { pending: 0, accepted: 0, expired: 0 } };
  }
}
