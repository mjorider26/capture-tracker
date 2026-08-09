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
import { requireBusinessMutationContext } from "@/lib/security/business-context";
import { correctPostedTransaction } from "@/lib/services/transaction-correction";
import { prisma } from "@/lib/prisma";
import type { TransactionCorrectionActionState } from "@/components/transaction-correction-form";

export type TransactionDocumentActionState = {
  ok: boolean;
  message?: string;
};

const idPattern = /^[A-Za-z0-9_-]{1,191}$/;

function documentMessage(
  state: "LINKED" | "ALREADY_LINKED" | "UNLINKED" | "ALREADY_UNLINKED",
) {
  return state === "LINKED"
    ? "Document linked."
    : state === "ALREADY_LINKED"
      ? "That document is already linked."
      : state === "UNLINKED"
        ? "Document unlinked. The record and its history were retained."
        : "That document was already unlinked.";
}

function documentError(code: "NOT_FOUND" | "DOCUMENT_NOT_ELIGIBLE" | "INVALID") {
  if (code === "DOCUMENT_NOT_ELIGIBLE")
    return "Only active, clean documents in private storage can be linked.";
  if (code === "NOT_FOUND") return "That transaction or document is unavailable.";
  return "The document link could not be changed safely.";
}

export async function linkAuthenticatedDocument(
  _previous: TransactionDocumentActionState,
  formData: FormData,
): Promise<TransactionDocumentActionState> {
  const transactionId = String(formData.get("transactionId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (!idPattern.test(transactionId) || !idPattern.test(documentId))
    return { ok: false, message: "The document link request is invalid." };
  try {
    const context = await requireBusinessMutationContext();
    const result = await linkDocumentToTransaction(
      { businessId: context.business.id, actorUserId: context.user.id },
      transactionId,
      documentId,
    );
    if (!result.ok) return { ok: false, message: documentError(result.code) };
    revalidatePath(`/app/money/${transactionId}`);
    revalidatePath(`/app/documents/${documentId}`);
    revalidatePath("/app/money");
    revalidatePath("/app/documents");
    return { ok: true, message: documentMessage(result.state) };
  } catch {
    return { ok: false, message: "Your document link could not be authorized." };
  }
}

export async function unlinkAuthenticatedDocument(
  _previous: TransactionDocumentActionState,
  formData: FormData,
): Promise<TransactionDocumentActionState> {
  const linkId = String(formData.get("linkId") ?? "");
  const transactionId = String(formData.get("transactionId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (![linkId, transactionId, documentId].every((id) => idPattern.test(id)))
    return { ok: false, message: "The document unlink request is invalid." };
  try {
    const context = await requireBusinessMutationContext();
    const result = await unlinkDocumentFromTransaction(
      { businessId: context.business.id, actorUserId: context.user.id },
      linkId,
    );
    if (!result.ok) return { ok: false, message: documentError(result.code) };
    revalidatePath(`/app/money/${transactionId}`);
    revalidatePath(`/app/documents/${documentId}`);
    revalidatePath("/app/money");
    revalidatePath("/app/documents");
    return { ok: true, message: documentMessage(result.state) };
  } catch {
    return { ok: false, message: "Your document unlink could not be authorized." };
  }
}

export async function reviewAuthenticatedTransaction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  try {
    const context = await requireBusinessMutationContext();
    const result = await reviewFromForm(
      {
        businessId: context.business.id,
        actorUserId: context.user.id,
        actorMembershipId: context.membership.id,
        role: context.membership.role,
        executionMode: "authenticated",
      },
      formData,
    );
    if (result.status === "success") {
      revalidatePath("/app/money");
      revalidatePath("/app/today");
    }
    return result;
  } catch {
    return { status: "error", message: "Your review could not be authorized." };
  }
}

export async function correctAuthenticatedTransaction(
  _previous: TransactionCorrectionActionState,
  formData: FormData,
): Promise<TransactionCorrectionActionState> {
  try {
    const context = await requireBusinessMutationContext();
    const result = await correctPostedTransaction(prisma, {
      businessId: context.business.id,
      actorUserId: context.user.id,
      actorMembershipId: context.membership.id,
      role: context.membership.role,
      executionMode: "authenticated",
    }, Object.fromEntries(formData));
    if (!result.ok) return { status: result.code === "CONFLICT" ? "conflict" : "error", message: "The transaction could not be corrected safely. Refresh and try again." };
    revalidatePath("/app/money"); revalidatePath("/app/activity"); revalidatePath("/app/today");
    revalidatePath(`/app/money/${String(formData.get("transactionId") ?? "")}`); revalidatePath(`/app/money/${result.transactionId}`);
    return { status: "success", message: result.code === "CORRECTED" ? "Correction posted. Opening the replacement record…" : "This correction was already posted. Opening the replacement record…", transactionId: result.transactionId };
  } catch { return { status: "error", message: "The transaction could not be corrected safely. Refresh and try again." }; }
}
