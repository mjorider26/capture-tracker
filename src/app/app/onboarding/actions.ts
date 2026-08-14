"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOnboardingContext } from "@/lib/security/business-context";
import {
  saveClientCutover,
  type CutoverState,
} from "@/lib/services/client-cutover";
import {
  addOnboardingAccount,
  advanceTour,
  chooseBankActivity,
  confirmReadiness,
  continueBankActivity,
  continueWelcome,
  markInitialActivityReviewed,
  revisitPhase,
  saveBusinessConfirmation,
  saveCustomerStartingBooks,
} from "@/lib/services/customer-onboarding";
import {
  completePlaidReconnect,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  syncPlaidBankConnection,
} from "@/lib/services/plaid-bank";
import {
  finalizeReconciliationFromForm,
  saveReconciliationFromForm,
  type AccountingActionState,
} from "@/lib/services/reconciliation-action";
import { startReconciliation } from "@/lib/services/reconciliation";
import {
  approveStatementActivityMatch,
  rejectStatementActivityCandidate,
  unmatchStatementActivity,
} from "@/lib/services/statement-activity-matching";
import {
  confirmTransactionImport,
  createImportPreview,
  ignoreExternalTransaction,
  postExternalTransaction,
} from "@/lib/services/financial-ingestion";
import { uploadPrivateDocument } from "@/lib/documents/secure-upload";
import { selectedDocumentUpload } from "@/lib/documents/upload-selection";
import type { DocumentUploadState } from "@/app/app/documents/actions";
import {
  mapConnectedFinancialAccount,
  setConnectedFinancialAccountSelection,
} from "@/lib/services/bank-sync";

async function setup() {
  const context = await requireOnboardingContext();
  return {
    context,
    actor: {
      businessId: context.business.id,
      actorUserId: context.user.id,
      role: "OWNER" as const,
    },
  };
}
const refresh = () => revalidatePath("/app/onboarding");
const updated = (): never => {
  refresh();
  redirect(`/app/onboarding?updated=${Date.now()}`);
};
const fail = (code: string): never =>
  redirect(`/app/onboarding?error=${encodeURIComponent(code)}`);

export async function continueWelcomeAction() {
  const { actor } = await setup();
  const result = await continueWelcome(actor);
  if (!result.ok) fail("stale");
  updated();
}
export async function saveBusinessConfirmationAction(form: FormData) {
  const { actor } = await setup();
  const result = await saveBusinessConfirmation(actor, form);
  if (!result.ok) fail("business");
  updated();
}
export async function chooseBankActivityAction(form: FormData) {
  const { actor } = await setup();
  const result = await chooseBankActivity(actor, form);
  if (!result.ok) fail("bank-choice");
  updated();
}
export async function continueBankActivityAction() {
  const { actor } = await setup();
  const result = await continueBankActivity(actor);
  if (!result.ok) fail("bank-incomplete");
  updated();
}
export async function addOnboardingAccountAction(form: FormData) {
  const { actor } = await setup();
  const result = await addOnboardingAccount(actor, form);
  if (!result.ok) fail("bank-account");
  updated();
}
export async function revisitOnboardingPhaseAction(form: FormData) {
  const { actor } = await setup();
  const result = await revisitPhase(actor, String(form.get("phase") ?? ""));
  if (!result.ok) fail("step-locked");
  updated();
}

export async function saveStartingBooksAction(form: FormData) {
  const { actor } = await setup();
  const result = await saveCustomerStartingBooks(actor, form);
  if (!result.ok) fail("starting-books");
  updated();
}

/** Compatibility export retained for the existing cutover component contract. */
export async function saveOnboardingAction(
  _: CutoverState,
  form: FormData,
): Promise<CutoverState> {
  const { context } = await setup();
  const result = await saveClientCutover(
    {
      businessId: context.business.id,
      actorUserId: context.user.id,
      membershipId: context.membership.id,
    },
    form,
  );
  if (result.ok) refresh();
  return result;
}

export async function markInitialActivityReviewedAction(form: FormData) {
  const { actor } = await setup();
  const result = await markInitialActivityReviewed(actor, form);
  if (!result.ok) fail("activity-review");
  updated();
}

const reconciliationActor = async () => {
  const { context } = await setup();
  return {
    businessId: context.business.id,
    actorUserId: context.user.id,
    actorMembershipId: context.membership.id,
    role: context.membership.role,
    executionMode: "authenticated" as const,
  };
};
export async function startOnboardingReconciliationAction(form: FormData) {
  const actor = await reconciliationActor();
  const result = await startReconciliation(prisma, actor, {
    accountId: form.get("accountId"),
    statementStartDate: form.get("statementStartDate"),
    statementEndDate: form.get("statementEndDate"),
    statementEndingBalance: form.get("statementEndingBalance"),
  });
  const reconciliationId = result.ok
    ? result.reconciliationId
    : fail("reconciliation-start");
  redirect(
    `/app/onboarding?reconciliation=${encodeURIComponent(reconciliationId)}`,
  );
}
export async function saveOnboardingReconciliationAction(
  _: AccountingActionState,
  form: FormData,
) {
  const result = await saveReconciliationFromForm(
    await reconciliationActor(),
    form,
  );
  if (result.status === "success") refresh();
  return result;
}
export async function finalizeOnboardingReconciliationAction(
  _: AccountingActionState,
  form: FormData,
) {
  const result = await finalizeReconciliationFromForm(
    await reconciliationActor(),
    form,
  );
  if (result.status === "success") {
    updated();
  }
  return result;
}
async function statement(
  action: typeof approveStatementActivityMatch,
  form: FormData,
) {
  try {
    const result = await action(
      prisma,
      await reconciliationActor(),
      Object.fromEntries(form),
    );
    if (result.ok) {
      refresh();
      return {
        status: "success" as const,
        message: `Statement activity ${result.state.toLowerCase()}.`,
      };
    }
    return {
      status:
        result.code === "STALE" ? ("conflict" as const) : ("error" as const),
      message: "This statement activity changed. Refresh and try again.",
    };
  } catch {
    return {
      status: "error" as const,
      message: "The statement activity could not be changed safely.",
    };
  }
}
export async function matchOnboardingStatementActivity(
  _: AccountingActionState,
  form: FormData,
) {
  return statement(approveStatementActivityMatch, form);
}
export async function rejectOnboardingStatementCandidate(
  _: AccountingActionState,
  form: FormData,
) {
  return statement(rejectStatementActivityCandidate, form);
}
export async function unmatchOnboardingStatementActivity(
  _: AccountingActionState,
  form: FormData,
) {
  return statement(unmatchStatementActivity, form);
}

export async function confirmReadinessAction() {
  const { actor } = await setup();
  const result = await confirmReadiness(actor);
  if (!result.ok) fail("readiness");
  refresh();
  redirect("/app/onboarding?tour=1");
}
export async function advanceTourAction(form: FormData) {
  const { actor } = await setup();
  const requested = Number(form.get("tourStep"));
  const result = await advanceTour(actor, requested);
  if (!result.ok) fail("tour");
  refresh();
  if (requested > 5) redirect("/app/today?welcome=1");
  redirect(`/app/onboarding?tour=${requested}`);
}

const plaidActor = async () => {
  const { context } = await setup();
  return {
    businessId: context.business.id,
    actorUserId: context.user.id,
    role: context.membership.role,
  };
};
export async function createOnboardingPlaidLinkToken(connectionId?: string) {
  try {
    return createPlaidLinkToken(await plaidActor(), connectionId);
  } catch {
    return {
      ok: false as const,
      message:
        "Secure bank connection is temporarily unavailable. You can use manual transaction import instead.",
    };
  }
}
export async function exchangeOnboardingPlaidPublicToken(publicToken: string) {
  try {
    const result = await exchangePlaidPublicToken(
      await plaidActor(),
      publicToken,
    );
    if (result.ok) refresh();
    return result;
  } catch {
    return {
      ok: false as const,
      message:
        "The secure bank connection could not be completed. You can retry or use manual import.",
    };
  }
}
export async function completeOnboardingPlaidReconnect(connectionId: string) {
  try {
    const result = await completePlaidReconnect(
      await plaidActor(),
      connectionId,
    );
    refresh();
    return result;
  } catch {
    return {
      ok: false as const,
      message: "The secure bank connection could not be restored.",
    };
  }
}
export async function mapOnboardingPlaidAccountAction(form: FormData) {
  const actor = await plaidActor();
  const connectedAccountId = String(form.get("connectedAccountId") ?? ""),
    financialAccountId = String(form.get("financialAccountId") ?? "");
  const selected = String(form.get("selected") ?? "true") === "true";
  const choice = await setConnectedFinancialAccountSelection(actor, {
    connectedAccountId,
    selected,
  });
  if (!choice.ok) fail("bank-incomplete");
  const result = await mapConnectedFinancialAccount(actor, {
    connectedAccountId,
    financialAccountId: financialAccountId || null,
  });
  if (!result.ok) fail("bank-incomplete");
  const connected = await prisma.connectedFinancialAccount.findFirst({
    where: { id: connectedAccountId, businessId: actor.businessId },
    select: { bankConnectionId: true },
  });
  if (connected)
    await syncPlaidBankConnection(actor, connected.bankConnectionId);
  updated();
}

type ImportPreview = Extract<
  Awaited<ReturnType<typeof createImportPreview>>,
  { ok: true }
>["preview"];
type ImportState = { ok: boolean; message?: string; preview?: ImportPreview };
const mapping = (form: FormData) => {
  try {
    return JSON.parse(String(form.get("mapping") ?? ""));
  } catch {
    return undefined;
  }
};
export async function previewOnboardingImport(
  _: ImportState,
  form: FormData,
): Promise<ImportState> {
  try {
    const { context } = await setup();
    const result = await createImportPreview(
      {
        businessId: context.business.id,
        actorUserId: context.user.id,
        role: context.membership.role,
      },
      {
        financialAccountId: String(form.get("financialAccountId") ?? ""),
        sourceFilename: String(form.get("sourceFilename") ?? ""),
        csvText: String(form.get("csvText") ?? ""),
        mapping: mapping(form),
        profileId: String(form.get("profileId") ?? ""),
      },
    );
    return result.ok
      ? {
          ok: true,
          preview: result.preview,
          message:
            "Preview ready. Confirm only after reviewing new, duplicate, and invalid activity.",
        }
      : { ok: false, message: result.message };
  } catch {
    return {
      ok: false,
      message: "The import preview could not be authorized.",
    };
  }
}
export async function confirmOnboardingImport(
  _: ImportState,
  form: FormData,
): Promise<ImportState> {
  try {
    const { context } = await setup();
    const result = await confirmTransactionImport(
      {
        businessId: context.business.id,
        actorUserId: context.user.id,
        role: context.membership.role,
      },
      {
        importId: String(form.get("importId") ?? ""),
        csvText: String(form.get("csvText") ?? ""),
        mapping: mapping(form),
        saveProfileName: String(form.get("saveProfileName") ?? ""),
      },
    );
    if (!result.ok) return { ok: false, message: result.message };
    refresh();
    revalidatePath("/app/onboarding/import");
    return {
      ok: true,
      message: `${result.created} activity row${result.created === 1 ? "" : "s"} imported for review.`,
    };
  } catch {
    return { ok: false, message: "The import could not be authorized." };
  }
}
export async function postOnboardingImportedTransaction(
  _: ImportState,
  form: FormData,
): Promise<ImportState> {
  try {
    const { context } = await setup();
    const result = await postExternalTransaction(
      {
        businessId: context.business.id,
        actorUserId: context.user.id,
        role: context.membership.role,
      },
      {
        externalTransactionId: String(form.get("externalTransactionId") ?? ""),
        ledgerAccountId: String(form.get("ledgerAccountId") ?? ""),
        createRule: String(form.get("createRule") ?? "") === "true",
      },
    );
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/app/onboarding/import");
    return { ok: true, message: "Transaction posted to the balanced journal." };
  } catch {
    return { ok: false, message: "The transaction could not be authorized." };
  }
}
export async function ignoreOnboardingImportedTransaction(
  _: ImportState,
  form: FormData,
): Promise<ImportState> {
  try {
    const { context } = await setup();
    const ok = await ignoreExternalTransaction(
      {
        businessId: context.business.id,
        actorUserId: context.user.id,
        role: context.membership.role,
      },
      String(form.get("externalTransactionId") ?? ""),
    );
    if (!ok)
      return {
        ok: false,
        message: "This imported activity could not be excluded safely.",
      };
    revalidatePath("/app/onboarding/import");
    return {
      ok: true,
      message: "Imported activity was excluded without changing the ledger.",
    };
  } catch {
    return { ok: false, message: "The request could not be authorized." };
  }
}

export async function uploadOnboardingStatement(
  _: DocumentUploadState,
  form: FormData,
): Promise<DocumentUploadState> {
  const file = selectedDocumentUpload(form);
  if (!file)
    return {
      ok: false,
      code: "INVALID",
      message: "Choose a PDF, JPEG, or PNG statement first.",
    };
  try {
    const { context } = await setup();
    const result = await uploadPrivateDocument(
      { businessId: context.business.id, actorUserId: context.user.id },
      file,
    );
    if (!result.ok)
      return {
        ok: false,
        code:
          result.code === "INVALID" ||
          result.code === "STORAGE" ||
          result.code === "REJECTED"
            ? result.code
            : "UNAVAILABLE",
        message: result.message,
      };
    await prisma.document.updateMany({
      where: {
        id: result.documentId,
        businessId: context.business.id,
        deletedAt: null,
      },
      data: { category: "BANK_STATEMENT", type: "BANK_STATEMENT" },
    });
    revalidatePath("/app/onboarding/statement");
    return {
      ok: true,
      documentId: result.documentId,
      outcome: result.outcome,
      message: result.duplicate
        ? "This statement already has a canonical private document record."
        : "Statement stored as private evidence. It did not create any transactions.",
    };
  } catch {
    return {
      ok: false,
      code: "UNAVAILABLE",
      message: "Private statement storage is unavailable. Please try again.",
    };
  }
}
