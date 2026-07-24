import "server-only";
import { prisma } from "../prisma";
import { finalizeReconciliation, saveReconciliationSelection, startReconciliation } from "./reconciliation";
import type { ReconciliationActor } from "./reconciliation-core";
export type AccountingActionState = { status: "idle" | "success" | "error" | "conflict" | "locked"; message: string | null };
export const initialAccountingActionState: AccountingActionState = { status: "idle", message: null };
const state = (result: { ok: boolean; code?: string; message?: string }): AccountingActionState => result.ok ? { status: "success", message: "Saved safely." } : { status: result.code === "CONFLICT" ? "conflict" : result.code === "IMMUTABLE" ? "locked" : "error", message: result.message ?? "The write could not be saved safely." };
export async function saveReconciliationFromForm(actor: ReconciliationActor, formData: FormData) { let selected: unknown = []; try { selected = JSON.parse(String(formData.get("selectedTransactionIds") ?? "[]")); } catch { selected = []; } return state(await saveReconciliationSelection(prisma, actor, { reconciliationId: formData.get("reconciliationId"), expectedVersion: formData.get("expectedVersion"), transactionIds: selected })); }
export async function finalizeReconciliationFromForm(actor: ReconciliationActor, formData: FormData) { return state(await finalizeReconciliation(prisma, actor, { reconciliationId: formData.get("reconciliationId"), expectedVersion: formData.get("expectedVersion") })); }
export async function startReconciliationFromForm(actor: ReconciliationActor, formData: FormData) { return state(await startReconciliation(prisma, actor, { accountId: formData.get("accountId"), statementStartDate: formData.get("statementStartDate"), statementEndDate: formData.get("statementEndDate"), statementEndingBalance: formData.get("statementEndingBalance") })); }
