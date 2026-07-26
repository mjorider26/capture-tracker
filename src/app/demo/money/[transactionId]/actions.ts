"use server";

import { revalidatePath } from "next/cache";

import {
  reviewFromForm,
  type ReviewActionState,
} from "@/lib/services/review-transaction-action";
import {
  linkDocumentToTransaction,
  unlinkDocumentFromTransaction,
} from "@/lib/documents/transaction-links";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import type { TransactionDocumentActionState } from "@/app/app/money/[transactionId]/actions";

const idPattern = /^[A-Za-z0-9_-]{1,191}$/;
const resultMessage = (state: "LINKED" | "ALREADY_LINKED" | "UNLINKED" | "ALREADY_UNLINKED") => state === "LINKED" ? "Document linked." : state === "ALREADY_LINKED" ? "That document is already linked." : state === "UNLINKED" ? "Document unlinked. The immutable relationship history was retained." : "That document was already unlinked.";

export async function linkDemoDocument(_: TransactionDocumentActionState, formData: FormData): Promise<TransactionDocumentActionState> {
  const transactionId = String(formData.get("transactionId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (![transactionId, documentId].every((id) => idPattern.test(id))) return { ok: false, message: "The document link request is invalid." };
  const context = await resolveLocalDemoContext();
  if (!context) return { ok: false, message: "Local demo linking is unavailable." };
  const result = await linkDocumentToTransaction({ businessId: context.businessId, actorUserId: context.userId }, transactionId, documentId);
  if (!result.ok) return { ok: false, message: result.code === "DOCUMENT_NOT_ELIGIBLE" ? "Only active, clean private demo documents can be linked." : "The document link could not be changed safely." };
  revalidatePath(`/demo/money/${transactionId}`); revalidatePath(`/demo/documents/${documentId}`); revalidatePath("/demo/money"); revalidatePath("/demo/documents");
  return { ok: true, message: resultMessage(result.state) };
}

export async function unlinkDemoDocument(_: TransactionDocumentActionState, formData: FormData): Promise<TransactionDocumentActionState> {
  const linkId = String(formData.get("linkId") ?? "");
  const transactionId = String(formData.get("transactionId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (![linkId, transactionId, documentId].every((id) => idPattern.test(id))) return { ok: false, message: "The document unlink request is invalid." };
  const context = await resolveLocalDemoContext();
  if (!context) return { ok: false, message: "Local demo linking is unavailable." };
  const result = await unlinkDocumentFromTransaction({ businessId: context.businessId, actorUserId: context.userId }, linkId);
  if (!result.ok) return { ok: false, message: "The document unlink could not be changed safely." };
  revalidatePath(`/demo/money/${transactionId}`); revalidatePath(`/demo/documents/${documentId}`); revalidatePath("/demo/money"); revalidatePath("/demo/documents");
  return { ok: true, message: resultMessage(result.state) };
}

export async function reviewDemoTransaction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const context = await resolveLocalDemoContext();
  if (!context)
    return { status: "error", message: "Local demo review is unavailable." };
  const result = await reviewFromForm(
    {
      businessId: context.businessId,
      actorUserId: context.userId,
      actorMembershipId: context.membershipId,
      role: context.role,
      executionMode: "demo",
    },
    formData,
  );
  if (result.status === "success") {
    revalidatePath("/demo/money");
    revalidatePath("/demo/today");
  }
  return result;
}
