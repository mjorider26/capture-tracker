import "server-only";

import { Prisma, type OnboardingPhase } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { setFinancialAccountBankFeedMethod } from "@/lib/services/bank-sync";
import { planOpeningBalanceLines } from "./customer-onboarding-core";

export type OnboardingActor = {
  businessId: string;
  actorUserId: string;
  role: "OWNER";
};
export type OnboardingActionResult = { ok: boolean; message: string };

const text = (value: FormDataEntryValue | null, max: number) =>
  typeof value === "string"
    ? value.replace(/[<>]/g, "").trim().slice(0, max)
    : "";
const date = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : null;
const phases = new Set<OnboardingPhase>([
  "WELCOME_PENDING",
  "BUSINESS_CONFIRMATION",
  "BANK_ACTIVITY_CHOICE",
  "PLAID_CONNECTION",
  "MANUAL_ACTIVITY",
  "STARTING_BOOKS_IN_PROGRESS",
  "INITIAL_ACTIVITY_REVIEW",
  "RECONCILIATION_REQUIRED",
  "READINESS_CHECK",
  "TOUR_PENDING",
  "COMPLETE",
]);

async function phase(
  actor: OnboardingActor,
  expected: OnboardingPhase[],
  next: OnboardingPhase,
  detail: string,
) {
  const changed = await prisma.businessOnboarding.updateMany({
    where: {
      businessId: actor.businessId,
      actorUserId: actor.actorUserId,
      phase: { in: expected },
      status: "IN_PROGRESS",
    },
    data: { phase: next },
  });
  if (changed.count !== 1)
    return {
      ok: false,
      message:
        "Setup changed in another tab. Refresh to continue from the saved step.",
    };
  await prisma.auditEvent.create({
    data: {
      actorType: "USER",
      businessId: actor.businessId,
      actorMembershipId: actor.actorUserId,
      action: "UPDATE",
      entityType: "CustomerOnboarding",
      entityId: actor.businessId,
      afterJson: { phase: next },
      metadataJson: { event: detail, accountingEffect: "none" },
    },
  });
  return { ok: true, message: "Progress saved." };
}

export async function getCustomerOnboardingState(businessId: string) {
  const [
    business,
    onboarding,
    cutover,
    accounts,
    connections,
    plaidAccounts,
    importedActivity,
    pendingActivity,
    reconciliations,
    reconciledAccounts,
  ] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        legalName: true,
        displayName: true,
        timezone: true,
        fiscalYearStartMonth: true,
        customerExperience: true,
      },
    }),
    prisma.businessOnboarding.findUnique({ where: { businessId } }),
    prisma.businessCutover.findUnique({ where: { businessId } }),
    prisma.financialAccount.findMany({
      where: {
        businessId,
        ownership: "BUSINESS",
        isActive: true,
        type: { in: ["CHECKING", "SAVINGS", "CREDIT_CARD"] },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        institutionName: true,
        lastFour: true,
        type: true,
        bankFeedMethod: true,
        openingBalance: true,
      },
    }),
    prisma.connectedFinancialAccount.count({
      where: {
        businessId,
        isSelected: true,
        financialAccountId: { not: null },
        connection: { state: { not: "DISCONNECTED" } },
      },
    }),
    prisma.connectedFinancialAccount.findMany({
      where: { businessId, connection: { state: { not: "DISCONNECTED" } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        accountType: true,
        maskedLastFour: true,
        isSelected: true,
        financialAccountId: true,
        connection: { select: { institutionName: true } },
      },
    }),
    prisma.transactionImport.count({
      where: { businessId, status: "COMPLETED" },
    }),
    prisma.externalTransaction.count({
      where: {
        businessId,
        status: { in: ["NEEDS_REVIEW", "SUGGESTED", "POSSIBLE_DUPLICATE"] },
      },
    }),
    prisma.reconciliation.findMany({
      where: { businessId },
      orderBy: [{ statementEndDate: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        financialAccountId: true,
        status: true,
        statementEndDate: true,
        version: true,
      },
    }),
    prisma.reconciliation.findMany({
      where: { businessId, status: "COMPLETED" },
      distinct: ["financialAccountId"],
      select: { financialAccountId: true },
    }),
  ]);
  return {
    business,
    onboarding,
    cutover,
    accounts,
    connections,
    plaidAccounts,
    importedActivity,
    pendingActivity,
    reconciliations,
    reconciledAccountIds: reconciledAccounts.map(
      (item) => item.financialAccountId,
    ),
  };
}

export async function continueWelcome(actor: OnboardingActor) {
  return phase(
    actor,
    ["WELCOME_PENDING"],
    "BUSINESS_CONFIRMATION",
    "WELCOME_COMPLETED",
  );
}

export async function saveBusinessConfirmation(
  actor: OnboardingActor,
  form: FormData,
): Promise<OnboardingActionResult> {
  const legalName = text(form.get("legalName"), 160),
    displayName = text(form.get("displayName"), 160),
    ownerDisplayName = text(form.get("ownerDisplayName"), 120),
    timezone = text(form.get("timezone"), 64),
    fiscalYearStartMonth = Number(form.get("fiscalYearStartMonth")),
    start = date(text(form.get("cutoverDate"), 10));
  if (
    !legalName ||
    !displayName ||
    !ownerDisplayName ||
    !start ||
    !/^America\/[A-Za-z_]+$/.test(timezone) ||
    !Number.isInteger(fiscalYearStartMonth) ||
    fiscalYearStartMonth < 1 ||
    fiscalYearStartMonth > 12
  )
    return {
      ok: false,
      message:
        "Enter the business facts and a valid date for when Capture Tracker should start keeping the books.",
    };
  await prisma.$transaction(async (tx) => {
    const current = await tx.businessOnboarding.findUnique({
      where: { businessId: actor.businessId },
      select: { phase: true },
    });
    if (
      !current ||
      !["BUSINESS_CONFIRMATION", "BANK_ACTIVITY_CHOICE"].includes(current.phase)
    )
      throw new Error("STALE_PHASE");
    await tx.business.update({
      where: { id: actor.businessId },
      data: { legalName, displayName, timezone, fiscalYearStartMonth },
    });
    await tx.businessCutover.update({
      where: { businessId: actor.businessId },
      data: { startDate: start, version: { increment: 1 } },
    });
    await tx.businessOnboarding.update({
      where: { businessId: actor.businessId },
      data: {
        ownerDisplayName,
        cutoverDate: start,
        businessConfirmed: true,
        phase: "BANK_ACTIVITY_CHOICE",
      },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        businessId: actor.businessId,
        actorMembershipId: actor.actorUserId,
        action: "UPDATE",
        entityType: "CustomerOnboarding",
        entityId: actor.businessId,
        afterJson: {
          phase: "BANK_ACTIVITY_CHOICE",
          businessConfirmed: true,
          cutoverDate: start.toISOString().slice(0, 10),
        },
        metadataJson: { event: "BUSINESS_CONFIRMED", accountingEffect: "none" },
      },
    });
  });
  return { ok: true, message: "Business details saved." };
}

export async function chooseBankActivity(
  actor: OnboardingActor,
  form: FormData,
): Promise<OnboardingActionResult> {
  const method = text(form.get("method"), 16);
  if (method !== "MANUAL" && method !== "PLAID")
    return {
      ok: false,
      message: "Choose automatic connection or manual transaction import.",
    };
  const [account, onboarding] = await Promise.all([
    prisma.financialAccount.findFirst({
      where: {
        businessId: actor.businessId,
        ownership: "BUSINESS",
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.businessOnboarding.findUnique({
      where: { businessId: actor.businessId },
      select: {
        phase: true,
        businessConfirmed: true,
        openingBalancesPosted: true,
      },
    }),
  ]);
  if (
    !onboarding?.businessConfirmed ||
    onboarding.openingBalancesPosted ||
    !["BANK_ACTIVITY_CHOICE", "PLAID_CONNECTION", "MANUAL_ACTIVITY"].includes(
      onboarding.phase,
    )
  )
    return {
      ok: false,
      message: "Continue from the saved bank activity step.",
    };
  if (!account)
    return {
      ok: false,
      message:
        "The initial business account is unavailable. Contact support before continuing.",
    };
  const methodResult = await setFinancialAccountBankFeedMethod(actor, {
    financialAccountId: account.id,
    method,
  });
  if (!methodResult.ok) return methodResult;
  await prisma.businessOnboarding.update({
    where: { businessId: actor.businessId },
    data: {
      preferredBankFeedMethod: method,
      phase: method === "PLAID" ? "PLAID_CONNECTION" : "MANUAL_ACTIVITY",
    },
  });
  await prisma.auditEvent.create({
    data: {
      actorType: "USER",
      businessId: actor.businessId,
      actorMembershipId: actor.actorUserId,
      action: "UPDATE",
      entityType: "CustomerOnboarding",
      entityId: actor.businessId,
      afterJson: {
        phase: method === "PLAID" ? "PLAID_CONNECTION" : "MANUAL_ACTIVITY",
        method,
      },
      metadataJson: {
        event:
          method === "PLAID" ? "PLAID_PATH_SELECTED" : "MANUAL_PATH_SELECTED",
        accountingEffect: "none",
      },
    },
  });
  return {
    ok: true,
    message: "Activity method saved. You can change it later for each account.",
  };
}

export async function addOnboardingAccount(
  actor: OnboardingActor,
  form: FormData,
): Promise<OnboardingActionResult> {
  const name = text(form.get("name"), 120),
    institutionName = text(form.get("institutionName"), 120) || null,
    lastFour = text(form.get("lastFour"), 4) || null,
    type = text(form.get("type"), 24),
    method = text(form.get("method"), 16);
  if (
    !name ||
    !["CHECKING", "SAVINGS", "CREDIT_CARD"].includes(type) ||
    !["MANUAL", "PLAID"].includes(method) ||
    (lastFour && !/^\d{4}$/.test(lastFour))
  )
    return {
      ok: false,
      message: "Enter a supported business bank or credit-card account.",
    };
  await prisma.$transaction(async (tx) => {
    const onboarding = await tx.businessOnboarding.findUnique({
      where: { businessId: actor.businessId },
      select: { phase: true, openingBalancesPosted: true },
    });
    if (
      !onboarding ||
      onboarding.openingBalancesPosted ||
      ![
        "BANK_ACTIVITY_CHOICE",
        "PLAID_CONNECTION",
        "MANUAL_ACTIVITY",
        "STARTING_BOOKS_IN_PROGRESS",
      ].includes(onboarding.phase)
    )
      throw new Error("ACCOUNT_SETUP_LOCKED");
    const liability = type === "CREDIT_CARD";
    const codes = await tx.ledgerAccount.findMany({
      where: {
        businessId: actor.businessId,
        type: liability ? "LIABILITY" : "ASSET",
      },
      select: { code: true },
    });
    const floor = liability ? 2000 : 1000;
    let numeric =
      Math.max(
        floor,
        ...codes.map((item) => Number(item.code)).filter(Number.isFinite),
      ) + 10;
    const used = new Set(codes.map((item) => item.code));
    while (used.has(String(numeric))) numeric += 10;
    const account = await tx.financialAccount.create({
      data: {
        businessId: actor.businessId,
        name,
        institutionName,
        lastFour,
        type: type as "CHECKING" | "SAVINGS" | "CREDIT_CARD",
        ownership: "BUSINESS",
        bankFeedMethod: method as "MANUAL" | "PLAID",
      },
    });
    await tx.ledgerAccount.create({
      data: {
        businessId: actor.businessId,
        code: String(numeric),
        name,
        type: liability ? "LIABILITY" : "ASSET",
        subtype: liability ? "CREDIT_CARD" : "BANK",
        normalBalance: liability ? "CREDIT" : "DEBIT",
        financialAccountId: account.id,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        businessId: actor.businessId,
        actorMembershipId: actor.actorUserId,
        action: "CREATE",
        entityType: "FinancialAccount",
        entityId: account.id,
        afterJson: { type, bankFeedMethod: method, businessOwned: true },
        metadataJson: {
          event: "ONBOARDING_ACCOUNT_ADDED",
          accountingEffect: "none",
        },
      },
    });
  });
  return { ok: true, message: "Business account added." };
}

export async function saveCustomerStartingBooks(
  actor: OnboardingActor,
  form: FormData,
): Promise<OnboardingActionResult> {
  const sourceReference = text(form.get("sourceReference"), 300),
    cutoverDate = date(text(form.get("cutoverDate"), 10));
  let accountIds: unknown;
  try {
    accountIds = JSON.parse(String(form.get("accountIds") ?? "[]"));
  } catch {
    accountIds = [];
  }
  if (
    !sourceReference ||
    !cutoverDate ||
    !Array.isArray(accountIds) ||
    !accountIds.length ||
    accountIds.some(
      (id) => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(id),
    ) ||
    form.get("ownerConfirmed") !== "on"
  )
    return {
      ok: false,
      message: "Confirm every starting balance from a supported source.",
    };
  const balances = new Map<string, Prisma.Decimal>();
  for (const id of accountIds as string[]) {
    const raw = text(form.get(`balance:${id}`), 19);
    if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(raw))
      return {
        ok: false,
        message: "Enter a valid non-negative balance for every account.",
      };
    balances.set(id, new Prisma.Decimal(raw));
  }
  const ownerMoneyInitialized = form.get("ownerMoneyInitialized") === "on",
    payrollYtdEstablished = form.get("payrollYtdEstablished") === "on",
    fixedAssetsReviewed = form.get("fixedAssetsReviewed") === "on";
  if (!ownerMoneyInitialized || !payrollYtdEstablished || !fixedAssetsReviewed)
    return {
      ok: false,
      message:
        "Review owner money, payroll context, and major assets before confirming starting books.",
    };
  try {
    await prisma.$transaction(
      async (tx) => {
        const [onboarding, cutover, accounts, retained] = await Promise.all([
          tx.businessOnboarding.findUnique({
            where: { businessId: actor.businessId },
          }),
          tx.businessCutover.findUnique({
            where: { businessId: actor.businessId },
          }),
          tx.financialAccount.findMany({
            where: {
              businessId: actor.businessId,
              id: { in: accountIds as string[] },
              ownership: "BUSINESS",
              isActive: true,
            },
            include: { ledgerAccount: true },
          }),
          tx.ledgerAccount.findUnique({
            where: {
              businessId_code: { businessId: actor.businessId, code: "3200" },
            },
          }),
        ]);
        if (
          !onboarding ||
          onboarding.phase !== "STARTING_BOOKS_IN_PROGRESS" ||
          !onboarding.businessConfirmed ||
          !onboarding.accountSetupCompleted ||
          !cutover ||
          onboarding.openingBalancesPosted ||
          cutover.openingJournalId ||
          accounts.length !== new Set(accountIds as string[]).size ||
          !retained ||
          accounts.some((account) => !account.ledgerAccount)
        )
          throw new Error("STARTING_BOOKS_UNAVAILABLE");
        const bounds = periodBounds(cutoverDate);
        const period = await tx.accountingPeriod.upsert({
          where: {
            businessId_startsAt_endsAt: {
              businessId: actor.businessId,
              ...bounds,
            },
          },
          create: { businessId: actor.businessId, ...bounds, status: "OPEN" },
          update: {},
        });
        let openingJournalId: string | null = null;
        const plan = planOpeningBalanceLines(
          accounts.map((account) => ({
            id: account.id,
            type: account.type as "CHECKING" | "SAVINGS" | "CREDIT_CARD",
            ledgerAccountId: account.ledgerAccount!.id,
            amount: balances.get(account.id)!.toFixed(2),
          })),
          retained.id,
        );
        if (!plan.balanced) throw new Error("UNBALANCED_OPENING_PLAN");
        if (plan.lines.length) {
          const entry = await tx.journalEntry.create({
            data: {
              businessId: actor.businessId,
              accountingPeriodId: period.id,
              entryNumber: `OPENING-${cutoverDate.getUTCFullYear()}`,
              entryDate: cutoverDate,
              description: "Approved opening balances cutover",
              status: "POSTED",
              sourceType: "OPENING_BALANCE",
              sourceEntityId: cutover.id,
              postedAt: new Date(),
              approvedByMembershipId: actor.actorUserId,
            },
          });
          openingJournalId = entry.id;
          await tx.journalLine.createMany({
            data: plan.lines.map((line, index) => ({
              businessId: actor.businessId,
              journalEntryId: entry.id,
              ledgerAccountId: line.ledgerAccountId,
              lineNumber: index + 1,
              debitAmount: line.debit,
              creditAmount: line.credit,
              memo: sourceReference,
            })),
          });
        }
        for (const account of accounts)
          await tx.financialAccount.update({
            where: { id: account.id },
            data: {
              openingBalance: balances.get(account.id)!,
              openedAt: cutoverDate,
              version: { increment: 1 },
            },
          });
        await tx.businessCutover.update({
          where: { businessId: actor.businessId },
          data: {
            startDate: cutoverDate,
            sourceReference,
            openingJournalId,
            version: { increment: 1 },
          },
        });
        await tx.businessOnboarding.update({
          where: { businessId: actor.businessId },
          data: {
            openingBalancesPosted: true,
            ownerMoneyInitialized: true,
            payrollYtdEstablished: true,
            fixedAssetsReviewed: true,
            accountSetupCompleted: true,
            ownerMoneyContext: "REVIEWED",
            payrollContext: "REVIEWED",
            fixedAssetsContext: "REVIEWED",
            accountingBasisReviewStatus: "CPA_REVIEW",
            phase: "INITIAL_ACTIVITY_REVIEW",
          },
        });
        await tx.auditEvent.create({
          data: {
            actorType: "USER",
            businessId: actor.businessId,
            actorMembershipId: actor.actorUserId,
            action: "CREATE",
            entityType: "OpeningBalanceCutover",
            entityId: openingJournalId ?? cutover.id,
            afterJson: {
              accountCount: accounts.length,
              balanced: true,
              zeroBalanceNoJournal: !openingJournalId,
              cutoverDate: cutoverDate.toISOString().slice(0, 10),
            },
            metadataJson: {
              event: "STARTING_BOOKS_CONFIRMED",
              ownerConfirmed: true,
              sourceReference,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { ok: true, message: "Starting books confirmed." };
  } catch {
    return { ok: false, message: "Starting books could not be saved safely." };
  }
}

function periodBounds(value: Date) {
  return {
    startsAt: new Date(Date.UTC(value.getUTCFullYear(), 0, 1)),
    endsAt: new Date(Date.UTC(value.getUTCFullYear(), 11, 31, 23, 59, 59, 999)),
  };
}

export async function continueBankActivity(
  actor: OnboardingActor,
): Promise<OnboardingActionResult> {
  const state = await getCustomerOnboardingState(actor.businessId);
  if (
    !state.onboarding ||
    !["PLAID_CONNECTION", "MANUAL_ACTIVITY"].includes(state.onboarding.phase)
  )
    return {
      ok: false,
      message: "Refresh to continue from the saved setup step.",
    };
  if (state.onboarding.phase === "PLAID_CONNECTION" && state.connections === 0)
    return {
      ok: false,
      message:
        "Finish the secure connection and map at least one selected account, or switch to manual import.",
    };
  await prisma.businessOnboarding.update({
    where: { businessId: actor.businessId },
    data: { accountSetupCompleted: true, phase: "STARTING_BOOKS_IN_PROGRESS" },
  });
  return { ok: true, message: "Bank activity setup saved." };
}

export async function markInitialActivityReviewed(
  actor: OnboardingActor,
  form: FormData,
): Promise<OnboardingActionResult> {
  const decision = text(form.get("activityDecision"), 32);
  if (!["REVIEWED", "NO_ACTIVITY_YET", "REVIEW_LATER"].includes(decision))
    return { ok: false, message: "Choose what applies to the first activity." };
  const record = await prisma.businessOnboarding.findUnique({
    where: { businessId: actor.businessId },
  });
  if (
    !record?.openingBalancesPosted ||
    record.phase !== "INITIAL_ACTIVITY_REVIEW"
  )
    return {
      ok: false,
      message: "Confirm starting books before reviewing activity.",
    };
  await prisma.businessOnboarding.update({
    where: { businessId: actor.businessId },
    data: { initialActivityReviewed: true, phase: "RECONCILIATION_REQUIRED" },
  });
  await prisma.auditEvent.create({
    data: {
      actorType: "USER",
      businessId: actor.businessId,
      actorMembershipId: actor.actorUserId,
      action: "UPDATE",
      entityType: "CustomerOnboarding",
      entityId: actor.businessId,
      afterJson: {
        phase: "RECONCILIATION_REQUIRED",
        activityDecision: decision,
      },
      metadataJson: {
        event: "INITIAL_ACTIVITY_REVIEWED",
        accountingEffect: "none",
      },
    },
  });
  return { ok: true, message: "First activity checkpoint saved." };
}

export async function confirmReadiness(
  actor: OnboardingActor,
): Promise<OnboardingActionResult> {
  const record = await prisma.businessOnboarding.findUnique({
    where: { businessId: actor.businessId },
  });
  if (
    !record ||
    !record.businessConfirmed ||
    !record.accountSetupCompleted ||
    !record.openingBalancesPosted ||
    !record.initialActivityReviewed ||
    !record.initialReconciliationComplete
  )
    return {
      ok: false,
      message: "Finish every required setup checkpoint before the tour.",
    };
  await prisma.businessOnboarding.update({
    where: { businessId: actor.businessId },
    data: {
      readinessConfirmed: true,
      phase: "TOUR_PENDING",
      tourStep: Math.max(1, record.tourStep),
    },
  });
  return {
    ok: true,
    message: "Readiness confirmed. The 60-second tour is ready.",
  };
}

export async function advanceTour(
  actor: OnboardingActor,
  requested: number,
): Promise<OnboardingActionResult> {
  const record = await prisma.businessOnboarding.findUnique({
    where: { businessId: actor.businessId },
  });
  if (!record || record.phase !== "TOUR_PENDING" || !record.readinessConfirmed)
    return {
      ok: false,
      message: "Finish the readiness check before the tour.",
    };
  const next = Math.min(5, Math.max(record.tourStep, requested));
  if (requested <= 5) {
    await prisma.businessOnboarding.update({
      where: { businessId: actor.businessId },
      data: { tourStep: next },
    });
    return { ok: true, message: "Tour progress saved." };
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const tourSkipped = record.tourStep < 5;
    await tx.businessOnboarding.update({
      where: { businessId: actor.businessId },
      data: {
        tourStep: 5,
        tourCompletedAt: now,
        phase: "COMPLETE",
        status: "COMPLETED",
        completedAt: now,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        businessId: actor.businessId,
        actorMembershipId: actor.actorUserId,
        action: "UPDATE",
        entityType: "CustomerOnboarding",
        entityId: actor.businessId,
        afterJson: { phase: "COMPLETE", status: "COMPLETED", tourSkipped },
        metadataJson: {
          event: "ONBOARDING_COMPLETED",
          accountingEffect: "none",
        },
      },
    });
  });
  return { ok: true, message: "Capture Tracker is ready." };
}

export async function revisitPhase(
  actor: OnboardingActor,
  requested: string,
): Promise<OnboardingActionResult> {
  if (!phases.has(requested as OnboardingPhase) || requested === "COMPLETE")
    return { ok: false, message: "That setup step is unavailable." };
  const record = await prisma.businessOnboarding.findUnique({
    where: { businessId: actor.businessId },
  });
  if (!record || record.status === "COMPLETED")
    return {
      ok: false,
      message: "Completed setup is preserved. Use Settings for later changes.",
    };
  const allowed: Partial<Record<OnboardingPhase, OnboardingPhase[]>> = {
    BANK_ACTIVITY_CHOICE: ["PLAID_CONNECTION", "MANUAL_ACTIVITY"],
    STARTING_BOOKS_IN_PROGRESS: ["INITIAL_ACTIVITY_REVIEW"],
    INITIAL_ACTIVITY_REVIEW: ["RECONCILIATION_REQUIRED"],
  };
  if (!allowed[requested as OnboardingPhase]?.includes(record.phase))
    return {
      ok: false,
      message: "Continue from the saved checkpoint to protect completed work.",
    };
  await prisma.businessOnboarding.update({
    where: { businessId: actor.businessId },
    data: { phase: requested as OnboardingPhase },
  });
  return {
    ok: true,
    message: "Earlier step opened. Saved work was preserved.",
  };
}
