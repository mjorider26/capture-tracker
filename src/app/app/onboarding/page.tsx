import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OnboardingPlaidLinkButton } from "@/components/onboarding-plaid-link-button";
import { OnboardingShell, SetupCard } from "@/components/onboarding-shell";
import { ReconciliationExperience } from "@/components/reconciliation-experience";
import { InlineAlert } from "@/components/ui";
import { getReconciliationDetail } from "@/lib/data/reconciliations";
import {
  isAccessControlError,
  requireOnboardingContext,
} from "@/lib/security/business-context";
import { getCustomerOnboardingState } from "@/lib/services/customer-onboarding";

import {
  addOnboardingAccountAction,
  advanceTourAction,
  chooseBankActivityAction,
  confirmReadinessAction,
  continueBankActivityAction,
  continueWelcomeAction,
  finalizeOnboardingReconciliationAction,
  mapOnboardingPlaidAccountAction,
  markInitialActivityReviewedAction,
  matchOnboardingStatementActivity,
  rejectOnboardingStatementCandidate,
  revisitOnboardingPhaseAction,
  saveBusinessConfirmationAction,
  saveOnboardingReconciliationAction,
  saveStartingBooksAction,
  startOnboardingReconciliationAction,
  unmatchOnboardingStatementActivity,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

const errors: Record<string, string> = {
  stale:
    "Setup changed in another tab. Your saved work is safe; continue from the step shown below.",
  business:
    "Those business details could not be saved. Check every required field and try again.",
  "bank-choice":
    "Choose one bank activity method. You can change it later for each account.",
  "bank-account":
    "That business account could not be added. Check the account type and optional last four digits.",
  "bank-incomplete":
    "Finish and map the secure connection, or switch to manual transaction import before continuing.",
  "starting-books":
    "Starting books could not be confirmed. Use supported source facts, complete every required review, and try again.",
  "activity-review":
    "Choose what applies to your first activity before continuing.",
  "reconciliation-start":
    "The reconciliation could not be started. Check the statement dates and ending balance.",
  readiness: "One or more required setup checkpoints still needs attention.",
  tour: "Tour progress could not be saved. Refresh and continue from the saved screen.",
  "step-locked":
    "That earlier step cannot be reopened from here because a dependent checkpoint is already saved.",
};

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reconciliation?: string }>;
}) {
  let context;
  try {
    context = await requireOnboardingContext();
  } catch (error) {
    if (isAccessControlError(error)) {
      if (error.status === 401) redirect("/sign-in");
      notFound();
    }
    throw error;
  }
  const query = await searchParams;
  const state = await getCustomerOnboardingState(context.business.id);
  if (!state.business || !state.onboarding || !state.cutover) notFound();
  const reconciliationId =
    query.reconciliation ??
    state.reconciliations.find((item) => item.status !== "COMPLETED")?.id;
  const detail =
    state.onboarding.phase === "RECONCILIATION_REQUIRED" && reconciliationId
      ? await getReconciliationDetail(context.business.id, reconciliationId)
      : null;
  return (
    <OnboardingShell
      businessName={state.business.displayName}
      phase={state.onboarding.phase}
    >
      {query.error && (
        <div className="mx-auto mb-5 max-w-3xl">
          <InlineAlert title="Setup needs attention" tone="warning">
            {errors[query.error] ??
              "That step could not be saved safely. Your earlier progress is unchanged."}
          </InlineAlert>
        </div>
      )}
      <Phase state={state} detail={detail} />
    </OnboardingShell>
  );
}

type State = Awaited<ReturnType<typeof getCustomerOnboardingState>>;
type Detail = Awaited<ReturnType<typeof getReconciliationDetail>>;

function Phase({ state, detail }: { state: State; detail: Detail }) {
  const { business, onboarding, cutover, accounts } = state;
  if (!business || !onboarding || !cutover) return null;
  const firstName = onboarding.ownerDisplayName.split(/\s+/)[0] || "there";
  const reconciledAccountIds = new Set(state.reconciledAccountIds);
  const accountsAwaitingInitialReconciliation = accounts.filter(
    (account) => !reconciledAccountIds.has(account.id),
  );

  if (onboarding.phase === "WELCOME_PENDING")
    return (
      <SetupCard
        eyebrow="About 10–15 minutes"
        title={`Welcome to Capture Tracker, ${firstName}.`}
        description="We’ll set up the facts Capture Tracker needs to keep your S-Corp books organized. You do not need to understand the app’s navigation or accounting terminology first."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <PromiseCard
            title="You’ll set up"
            items={[
              "Your S-Corp details",
              "Bank or credit-card activity",
              "Starting balances and owner context",
              "One exact reconciliation",
            ]}
          />
          <PromiseCard
            title="What Capture Tracker does"
            items={[
              "Keeps imported activity in review",
              "Protects private documents",
              "Uses balanced, auditable records",
              "Shows your daily and weekly routine",
            ]}
          />
        </div>
        <p className="mt-5 text-sm leading-6 text-text-muted">
          Have your latest bank or card statement nearby. If you do not know an
          accounting answer, choose <strong>Needs review</strong>—Capture
          Tracker will not guess.
        </p>
        <form action={continueWelcomeAction} className="mt-6">
          <button className="ui-button ui-button-primary min-h-12 w-full px-5 font-bold sm:w-auto">
            Start setup
          </button>
        </form>
      </SetupCard>
    );

  if (onboarding.phase === "BUSINESS_CONFIRMATION")
    return (
      <SetupCard
        eyebrow="Business"
        title="Tell us about your S-Corp"
        description="Confirm the business facts that belong on this workspace, then choose when Capture Tracker should start keeping your books."
      >
        <form action={saveBusinessConfirmationAction} className="grid gap-5">
          <Field label="Legal business name">
            <input
              required
              name="legalName"
              maxLength={160}
              className="ui-input mt-1"
              defaultValue={business.legalName}
            />
          </Field>
          <Field label="Name you want to see in Capture Tracker">
            <input
              required
              name="displayName"
              maxLength={160}
              className="ui-input mt-1"
              defaultValue={business.displayName}
            />
          </Field>
          <Field label="Your name">
            <input
              required
              name="ownerDisplayName"
              maxLength={120}
              className="ui-input mt-1"
              defaultValue={onboarding.ownerDisplayName}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business timezone">
              <input
                required
                name="timezone"
                className="ui-input mt-1"
                defaultValue={business.timezone}
              />
            </Field>
            <Field label="Fiscal year starts in">
              <select
                required
                name="fiscalYearStartMonth"
                className="ui-input mt-1"
                defaultValue={business.fiscalYearStartMonth}
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="When should Capture Tracker start keeping your books?">
            <input
              required
              type="date"
              name="cutoverDate"
              className="ui-input mt-1"
              defaultValue={
                onboarding.cutoverDate?.toISOString().slice(0, 10) ??
                cutover.startDate.toISOString().slice(0, 10)
              }
            />
            <span className="mt-2 block text-xs font-normal leading-5 text-text-muted">
              Use the first day Capture Tracker becomes your source of record.
              Earlier history can remain with your prior records. If you are
              unsure, pause and ask your CPA.
            </span>
          </Field>
          <button className="ui-button ui-button-primary min-h-12 px-5 font-bold">
            Save and continue
          </button>
        </form>
      </SetupCard>
    );

  if (onboarding.phase === "BANK_ACTIVITY_CHOICE")
    return (
      <SetupCard
        eyebrow="Bank activity"
        title="How do you want to bring in your bank activity?"
        description="Choose the method that fits you. Both methods use the same private review queue, and nothing posts to your books automatically."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ChoiceForm
            method="PLAID"
            title="Connect automatically"
            detail="Use Plaid’s secure connection for read-only account identity and Transactions activity. Capture Tracker never receives your bank password."
            badge="Least ongoing work"
          />
          <ChoiceForm
            method="MANUAL"
            title="Import it myself"
            detail="Download a transaction CSV from your bank and upload it when you are ready. No bank login is shared."
            badge="No bank connection required"
          />
        </div>
        <p className="mt-5 text-sm leading-6 text-text-muted">
          You can mix methods across accounts and change them later without
          deleting prior imports or posted history.
        </p>
      </SetupCard>
    );

  if (onboarding.phase === "PLAID_CONNECTION")
    return (
      <SetupCard
        eyebrow="Automatic bank activity"
        title="Connect only the business accounts you want"
        description="Plaid Link lets you select an institution and accounts. Capture Tracker requests Transactions only—no transfers, payments, Auth, or money movement."
      >
        <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-secondary p-4 text-sm leading-6">
          <p>
            <strong>What is shared:</strong> selected account identity and
            read-only transaction activity.
          </p>
          <p className="mt-2">
            <strong>What is not shared:</strong> your bank password, payment
            authority, or the ability to move money.
          </p>
        </div>
        <div className="mt-5">
          <OnboardingPlaidLinkButton />
        </div>
        {state.plaidAccounts.length > 0 && (
          <section className="mt-5 grid gap-3">
            <h2 className="font-bold text-brand-navy">
              Choose where each connected account belongs
            </h2>
            {state.plaidAccounts.map((connected) => (
              <form
                key={connected.id}
                action={mapOnboardingPlaidAccountAction}
                className="grid gap-3 rounded-[var(--radius-md)] border border-border-subtle p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <input
                  type="hidden"
                  name="connectedAccountId"
                  value={connected.id}
                />
                <input type="hidden" name="selected" value="true" />
                <div>
                  <p className="font-bold">{connected.name}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {connected.connection.institutionName ??
                      "Financial institution"}
                    {connected.maskedLastFour
                      ? ` · ending ${connected.maskedLastFour}`
                      : ""}{" "}
                    · {connected.accountType.toLowerCase()}
                  </p>
                </div>
                <Field label="Capture Tracker account">
                  <select
                    required
                    name="financialAccountId"
                    className="ui-input mt-1"
                    defaultValue={connected.financialAccountId ?? ""}
                  >
                    <option value="">Choose account</option>
                    {accounts
                      .filter((account) => account.bankFeedMethod === "PLAID")
                      .map((account) => (
                        <option value={account.id} key={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <button className="ui-button ui-button-secondary min-h-11 border border-border-subtle px-4 font-bold">
                  Save mapping
                </button>
              </form>
            ))}
          </section>
        )}
        <AddAccountForm method="PLAID" />
        <p className="mt-4 text-sm text-text-muted">
          Connected and mapped accounts: <strong>{state.connections}</strong>.
          If your institution is unavailable, manual transaction import remains
          fully supported.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <form action={continueBankActivityAction}>
            <button
              disabled={state.connections < 1}
              className="ui-button ui-button-primary min-h-12 w-full px-5 font-bold disabled:opacity-50 sm:w-auto"
            >
              Continue with connected account
            </button>
          </form>
          <form action={revisitOnboardingPhaseAction}>
            <input type="hidden" name="phase" value="BANK_ACTIVITY_CHOICE" />
            <button className="ui-button ui-button-secondary min-h-12 w-full border border-border-subtle px-5 font-bold sm:w-auto">
              Use manual import instead
            </button>
          </form>
        </div>
      </SetupCard>
    );

  if (onboarding.phase === "MANUAL_ACTIVITY")
    return (
      <SetupCard
        eyebrow="Manual bank activity"
        title="Bring in activity without connecting a bank"
        description="Choose the right file for the job. A transaction file can add activity for review; statements and receipts are evidence only."
      >
        <div className="grid gap-4">
          <FileKind
            title="Transaction file"
            label="CSV"
            detail="Adds dated bank or card activity to the review queue. Preview, mapping, duplicate detection, and explicit confirmation happen before anything is imported."
            action={
              <Link
                href="/app/onboarding/import"
                className="ui-button ui-button-secondary min-h-11 border border-border-subtle px-4 pt-3 text-sm font-bold"
              >
                Import a transaction CSV
              </Link>
            }
          />
          <FileKind
            title="Bank or card statement"
            label="PDF or image"
            detail="Stores private statement evidence for reconciliation. A statement never creates transactions."
            action={
              <Link
                href="/app/onboarding/statement"
                className="ui-button ui-button-secondary min-h-11 border border-border-subtle px-4 pt-3 text-sm font-bold"
              >
                Upload statement evidence
              </Link>
            }
          />
          <FileKind
            title="Receipts"
            label="PDF or image"
            detail="Supports business purchases and document matching. A receipt never becomes bank activity by itself."
          />
        </div>
        <AddAccountForm method="MANUAL" />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <form action={continueBankActivityAction}>
            <button className="ui-button ui-button-primary min-h-12 w-full px-5 font-bold sm:w-auto">
              Continue to starting books
            </button>
          </form>
          <form action={revisitOnboardingPhaseAction}>
            <input type="hidden" name="phase" value="BANK_ACTIVITY_CHOICE" />
            <button className="ui-button ui-button-secondary min-h-12 w-full border border-border-subtle px-5 font-bold sm:w-auto">
              Change method
            </button>
          </form>
        </div>
      </SetupCard>
    );

  if (onboarding.phase === "STARTING_BOOKS_IN_PROGRESS") {
    return (
      <SetupCard
        eyebrow="Starting books"
        title="Let’s get your starting books right"
        description="Use statements or another approved source. Capture Tracker records one balanced opening entry for all non-zero balances; confirmed $0.00 accounts create no journal line."
      >
        {!accounts.length ? (
          <InlineAlert title="Account setup unavailable" tone="warning">
            The initial business account is missing. Contact support before
            entering balances.
          </InlineAlert>
        ) : (
          <form action={saveStartingBooksAction} className="grid gap-5">
            <input
              type="hidden"
              name="cutoverDate"
              value={(onboarding.cutoverDate ?? cutover.startDate)
                .toISOString()
                .slice(0, 10)}
            />
            <input
              type="hidden"
              name="accountIds"
              value={JSON.stringify(accounts.map((account) => account.id))}
            />
            <section className="grid gap-3">
              <h2 className="font-bold text-brand-navy">
                Balances on{" "}
                {(
                  onboarding.cutoverDate ?? cutover.startDate
                ).toLocaleDateString()}
              </h2>
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="grid gap-3 rounded-[var(--radius-md)] border border-border-subtle p-4 sm:grid-cols-[1fr_minmax(10rem,14rem)] sm:items-center"
                >
                  <div>
                    <p className="font-bold text-brand-navy">{account.name}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {account.institutionName ??
                        account.type.toLowerCase().replaceAll("_", " ")}
                      {account.lastFour ? ` · ending ${account.lastFour}` : ""}{" "}
                      ·{" "}
                      {account.bankFeedMethod === "PLAID"
                        ? "automatic"
                        : "manual CSV"}
                    </p>
                  </div>
                  <Field label="Confirmed balance">
                    <div className="relative mt-1">
                      <span
                        aria-hidden="true"
                        className="absolute left-3 top-3 text-text-muted"
                      >
                        $
                      </span>
                      <input
                        required
                        name={`balance:${account.id}`}
                        inputMode="decimal"
                        pattern="(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?"
                        className="ui-input pl-7"
                        placeholder="0.00"
                        defaultValue={account.openingBalance.toFixed(2)}
                      />
                    </div>
                  </Field>
                </div>
              ))}
            </section>
            <Field label="Approved source for these balances">
              <input
                required
                name="sourceReference"
                maxLength={300}
                className="ui-input mt-1"
                placeholder="Example: statements ending June 30"
              />
              <span className="mt-2 block text-xs font-normal text-text-muted">
                Keep every statement or report as supporting evidence. Do not
                enter a guess.
              </span>
            </Field>
            <ReviewCheck
              name="ownerMoneyInitialized"
              title="Owner money reviewed"
              detail="I reviewed personal money put into the S-Corp, distributions, owner-paid expenses, reimbursements, and shareholder loans. Anything uncertain is marked Needs review."
            />
            <ReviewCheck
              name="payrollYtdEstablished"
              title="Payroll context reviewed"
              detail="I recorded whether owner payroll is already running and kept payroll provider or year-to-date details for later review. Capture Tracker does not run payroll."
            />
            <ReviewCheck
              name="fixedAssetsReviewed"
              title="Major assets reviewed"
              detail="I considered equipment, vehicles, and other major assets. Uncertain depreciation or tax basis stays for CPA review."
            />
            <div className="rounded-[var(--radius-md)] border border-status-warning/40 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <strong>Shareholder basis is not guessed here.</strong> Its setup
              status remains Unknown / CPA review until supported records are
              available.
            </div>
            <label className="flex items-start gap-3 text-sm font-bold">
              <input
                required
                type="checkbox"
                name="ownerConfirmed"
                className="mt-1 h-5 w-5"
              />
              <span>
                I confirm these are supported source facts and authorize the
                balanced opening entry, if one is needed.
              </span>
            </label>
            <button className="ui-button ui-button-primary min-h-12 px-5 font-bold">
              Confirm starting books
            </button>
          </form>
        )}
      </SetupCard>
    );
  }

  if (onboarding.phase === "INITIAL_ACTIVITY_REVIEW")
    return (
      <SetupCard
        eyebrow="First activity"
        title="Let’s review your first activity"
        description="Imported activity remains unposted until you approve a business category. If there is no activity yet, say so and continue."
      >
        <div className="grid gap-3 rounded-[var(--radius-md)] border border-border-subtle bg-surface-secondary p-4 text-sm">
          <p>
            Completed imports: <strong>{state.importedActivity}</strong>
          </p>
          <p>
            Items waiting for review: <strong>{state.pendingActivity}</strong>
          </p>
        </div>
        {onboarding.preferredBankFeedMethod === "MANUAL" && (
          <Link
            href="/app/onboarding/import"
            className="mt-5 inline-flex min-h-11 items-center font-bold text-brand-navy underline underline-offset-4"
          >
            Open transaction import and review
          </Link>
        )}
        <form
          action={markInitialActivityReviewedAction}
          className="mt-6 grid gap-3"
        >
          <label className="rounded-[var(--radius-md)] border border-border-subtle p-4 text-sm">
            <input
              required
              type="radio"
              name="activityDecision"
              value="REVIEWED"
              className="mr-3"
            />
            I reviewed the available first activity.
          </label>
          <label className="rounded-[var(--radius-md)] border border-border-subtle p-4 text-sm">
            <input
              required
              type="radio"
              name="activityDecision"
              value="NO_ACTIVITY_YET"
              className="mr-3"
            />
            There is no business activity yet.
          </label>
          <label className="rounded-[var(--radius-md)] border border-border-subtle p-4 text-sm">
            <input
              required
              type="radio"
              name="activityDecision"
              value="REVIEW_LATER"
              className="mr-3"
            />
            The imported activity will stay in review for later.
          </label>
          <button className="ui-button ui-button-primary min-h-12 px-5 font-bold">
            Continue to reconciliation
          </button>
        </form>
      </SetupCard>
    );

  if (onboarding.phase === "RECONCILIATION_REQUIRED")
    return (
      <SetupCard
        eyebrow="Reconcile"
        title="Make sure Capture Tracker agrees with your bank"
        description="Enter the statement period and ending balance, select cleared activity, and finish only when the difference is exactly $0.00."
      >
        {detail ? (
          <>
            <ReconciliationExperience
              detail={detail}
              saveAction={saveOnboardingReconciliationAction}
              finalizeAction={finalizeOnboardingReconciliationAction}
              matchAction={matchOnboardingStatementActivity}
              rejectAction={rejectOnboardingStatementCandidate}
              unmatchAction={unmatchOnboardingStatementActivity}
            />
            <HelpBlock />
          </>
        ) : (
          <form
            action={startOnboardingReconciliationAction}
            className="grid gap-5"
          >
            <p className="text-sm leading-6 text-text-muted">
              Reconcile each business account once before readiness. Accounts
              remaining:{" "}
              <strong>{accountsAwaitingInitialReconciliation.length}</strong>.
            </p>
            {accountsAwaitingInitialReconciliation.length > 1 && (
              <Field label="Account">
                <select name="accountId" className="ui-input mt-1">
                  {accountsAwaitingInitialReconciliation.map((account) => (
                    <option value={account.id} key={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {accountsAwaitingInitialReconciliation[0] &&
              accountsAwaitingInitialReconciliation.length === 1 && (
                <input
                  type="hidden"
                  name="accountId"
                  value={accountsAwaitingInitialReconciliation[0].id}
                />
              )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Statement start date">
                <input
                  required
                  type="date"
                  name="statementStartDate"
                  className="ui-input mt-1"
                />
              </Field>
              <Field label="Statement end date">
                <input
                  required
                  type="date"
                  name="statementEndDate"
                  className="ui-input mt-1"
                />
              </Field>
            </div>
            <Field label="Statement ending balance">
              <div className="relative mt-1">
                <span
                  aria-hidden="true"
                  className="absolute left-3 top-3 text-text-muted"
                >
                  $
                </span>
                <input
                  required
                  name="statementEndingBalance"
                  inputMode="decimal"
                  className="ui-input pl-7"
                  placeholder="0.00"
                />
              </div>
            </Field>
            <p className="text-sm leading-6 text-text-muted">
              Use the statement’s printed ending balance. Capture Tracker never
              creates a plug or automatic balancing entry.
            </p>
            <button className="ui-button ui-button-primary min-h-12 px-5 font-bold">
              Start reconciliation
            </button>
          </form>
        )}
      </SetupCard>
    );

  if (onboarding.phase === "READINESS_CHECK")
    return (
      <SetupCard
        eyebrow="Ready check"
        title="Your starting books are confirmed"
        description="Capture Tracker has the required starting facts and an exact first reconciliation. Review the handoff before the short tour."
      >
        <ul className="grid gap-3 text-sm">
          <ReadyRow ok={onboarding.businessConfirmed}>
            Business details confirmed
          </ReadyRow>
          <ReadyRow ok={onboarding.accountSetupCompleted}>
            Bank activity method selected
          </ReadyRow>
          <ReadyRow ok={onboarding.openingBalancesPosted}>
            Starting balance confirmed
          </ReadyRow>
          <ReadyRow ok={onboarding.initialActivityReviewed}>
            First activity checkpoint complete
          </ReadyRow>
          <ReadyRow ok={onboarding.initialReconciliationComplete}>
            Reconciliation difference is exactly $0.00
          </ReadyRow>
        </ul>
        <div className="mt-5 rounded-[var(--radius-md)] border border-status-warning/40 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>Professional review stays visible:</strong> shareholder basis
          is{" "}
          {onboarding.accountingBasisReviewStatus
            .toLowerCase()
            .replaceAll("_", " ")}
          ; any owner money, payroll, or asset item marked Needs review remains
          available for follow-up.
        </div>
        <form action={confirmReadinessAction} className="mt-6">
          <button className="ui-button ui-button-primary min-h-12 w-full px-5 font-bold sm:w-auto">
            Start the 60-second tour
          </button>
        </form>
      </SetupCard>
    );

  if (onboarding.phase === "TOUR_PENDING")
    return <Tour step={Math.max(1, onboarding.tourStep)} />;

  return (
    <SetupCard
      eyebrow="Setup complete"
      title="Capture Tracker is ready"
      description="Your setup is complete, the navigation is unlocked, and your normal routine starts on Today."
    >
      <div className="rounded-[var(--radius-md)] bg-brand-navy p-6 text-white">
        <h2 className="text-xl font-bold">
          Your books now have a clear starting point.
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/75">
          Use Today for the next owner decision, + New as business happens, and
          Run My Books for your weekly routine.
        </p>
      </div>
      <Link
        href="/app/today?welcome=1"
        className="ui-button ui-button-primary mt-6 inline-flex min-h-12 items-center px-5 font-bold"
      >
        Go to Today
      </Link>
    </SetupCard>
  );
}

function ChoiceForm({
  method,
  title,
  detail,
  badge,
}: {
  method: "PLAID" | "MANUAL";
  title: string;
  detail: string;
  badge: string;
}) {
  return (
    <form
      action={chooseBankActivityAction}
      className="flex flex-col rounded-[var(--radius-md)] border border-border-subtle bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="method" value={method} />
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-teal">
        {badge}
      </p>
      <h2 className="mt-2 text-xl font-bold text-brand-navy">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-text-muted">{detail}</p>
      <button className="ui-button ui-button-primary mt-5 min-h-12 px-4 font-bold">
        Choose {title.toLowerCase()}
      </button>
    </form>
  );
}
function PromiseCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-border-subtle p-4">
      <h2 className="font-bold text-brand-navy">{title}</h2>
      <ul className="mt-3 grid gap-2 text-sm text-text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="text-brand-teal">
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold text-brand-navy">
      {label}
      {children}
    </label>
  );
}
function ReviewCheck({
  name,
  title,
  detail,
}: {
  name: string;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border-subtle p-4">
      <input required type="checkbox" name={name} className="mt-1 h-5 w-5" />
      <span>
        <strong className="text-sm text-brand-navy">{title}</strong>
        <span className="mt-1 block text-sm leading-6 text-text-muted">
          {detail}
        </span>
      </span>
    </label>
  );
}
function FileKind({
  title,
  label,
  detail,
  action,
}: {
  title: string;
  label: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-md)] border border-border-subtle p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold text-brand-navy">{title}</h2>
          <span className="rounded-full bg-brand-teal-soft px-2 py-1 text-xs font-bold text-brand-navy">
            {label}
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
          {detail}
        </p>
      </div>
      {action && <div className="mt-3 shrink-0 sm:mt-0">{action}</div>}
    </section>
  );
}
function AddAccountForm({ method }: { method: "MANUAL" | "PLAID" }) {
  return (
    <details className="mt-5 rounded-[var(--radius-md)] border border-border-subtle bg-white p-4">
      <summary className="cursor-pointer font-bold text-brand-navy">
        Do you have another business bank or credit card?
      </summary>
      <form
        action={addOnboardingAccountAction}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="method" value={method} />
        <Field label="Account name">
          <input
            required
            name="name"
            maxLength={120}
            className="ui-input mt-1"
            placeholder="Business savings"
          />
        </Field>
        <Field label="Account type">
          <select required name="type" className="ui-input mt-1">
            <option value="CHECKING">Business checking</option>
            <option value="SAVINGS">Business savings</option>
            <option value="CREDIT_CARD">Business credit card</option>
          </select>
        </Field>
        <Field label="Institution (optional)">
          <input
            name="institutionName"
            maxLength={120}
            className="ui-input mt-1"
          />
        </Field>
        <Field label="Last four digits (optional)">
          <input
            name="lastFour"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            className="ui-input mt-1"
          />
        </Field>
        <button className="ui-button ui-button-secondary min-h-11 border border-border-subtle px-4 font-bold sm:col-span-2">
          Add business account
        </button>
      </form>
    </details>
  );
}
function ReadyRow({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border-subtle p-4">
      <span
        aria-hidden="true"
        className={`grid h-7 w-7 place-items-center rounded-full font-bold ${ok ? "bg-brand-teal text-white" : "bg-amber-100 text-amber-900"}`}
      >
        {ok ? "✓" : "!"}
      </span>
      <span className="font-bold text-brand-navy">{children}</span>
    </li>
  );
}
function HelpBlock() {
  return (
    <details className="mt-5 rounded-[var(--radius-md)] border border-border-subtle p-4 text-sm">
      <summary className="cursor-pointer font-bold text-brand-navy">
        Why isn’t the difference $0.00?
      </summary>
      <ul className="mt-3 grid gap-2 pl-5 text-text-muted">
        <li className="list-disc">
          Check the statement ending balance and dates.
        </li>
        <li className="list-disc">
          Select every cleared book transaction for the period.
        </li>
        <li className="list-disc">
          Look for duplicate, missing, or still-pending activity.
        </li>
        <li className="list-disc">
          Do not add an unsupported balancing transaction. Ask for help if
          source evidence disagrees.
        </li>
      </ul>
    </details>
  );
}

const tour = [
  [
    "Today",
    "Today tells you what needs attention",
    "Start here. It brings forward the next owner decision and shows whether your books are current.",
  ],
  [
    "Quick Add",
    "Record things as they happen",
    "Use + New for a receipt, invoice, bill, mileage, or other business activity without hunting through navigation.",
  ],
  [
    "Run My Books",
    "This is your weekly routine",
    "Review transactions, receipts, Owner Money, payroll, and reconciliation exceptions in one guided queue.",
  ],
  [
    "Month-end",
    "Once a month",
    "Reconcile each bank and card account to an exact $0.00 difference, then review reports and close the month.",
  ],
  [
    "Year-end / CPA",
    "When it’s time for your CPA",
    "Use year-end readiness, exports, and controlled CPA access. Items marked Needs review stay visible; Capture Tracker never invents a tax answer.",
  ],
] as const;
function Tour({ step }: { step: number }) {
  const current = tour[Math.min(5, Math.max(1, step)) - 1];
  const next = step >= 5 ? 6 : step + 1;
  return (
    <SetupCard
      eyebrow={`60-second tour · ${step} of 5 · ${current[0]}`}
      title={current[1]}
      description={current[2]}
    >
      <div className="rounded-[var(--radius-md)] bg-brand-navy p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">
          {current[0]}
        </p>
        <div
          aria-hidden="true"
          className="mt-5 grid min-h-40 place-items-center rounded-xl border border-white/15 bg-white/5"
        >
          <span className="text-5xl">
            {step === 1
              ? "☀"
              : step === 2
                ? "+"
                : step === 3
                  ? "✓"
                  : step === 4
                    ? "$0"
                    : "↗"}
          </span>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {step < 5 && (
          <form action={advanceTourAction}>
            <input type="hidden" name="tourStep" value="6" />
            <button className="ui-button ui-button-secondary min-h-12 w-full border border-border-subtle px-5 font-bold sm:w-auto">
              Skip tour and go to Today
            </button>
          </form>
        )}
        <form action={advanceTourAction}>
          <input type="hidden" name="tourStep" value={next} />
          <button className="ui-button ui-button-primary min-h-12 w-full px-5 font-bold sm:w-auto">
            {step >= 5 ? "Finish tour and go to Today" : "Next"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-xs leading-5 text-text-muted">
        You can review the full daily, weekly, monthly, and year-end routine
        later from How to Run My Books in Help.
      </p>
    </SetupCard>
  );
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
