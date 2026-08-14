# Capture Tracker Product Manual

## Getting Started

Capture Tracker begins with a private, email-bound invitation. Create an account with the invited email, sign in, and accept the one-time invitation. The guided setup then replaces normal navigation until the required starting facts are complete. Progress is saved after every step, so it is safe to sign out and return later.

The setup sequence is:

1. Read the welcome and expectations.
2. Confirm the S-Corp name, owner, timezone, fiscal-year start, and the date Capture Tracker should begin keeping the books.
3. Choose automatic Plaid activity or manual transaction CSV import for each business bank or card account. Different accounts may use different methods.
4. Confirm every opening balance from a statement or other approved source. A confirmed zero creates no opening journal; non-zero balances are posted together in one balanced opening journal.
5. Review Owner Money, payroll context, major assets, and any Unknown / Needs review / CPA review items.
6. Review the first activity, or confirm there is no activity yet.
7. Reconcile the first statement to an exact $0.00 difference.
8. Complete the readiness check and five-screen tour, then start on Today.

The manual file choices are deliberately different. A **transaction CSV** can add dated bank or card activity to the review queue. A **statement PDF/image** is private reconciliation evidence and never creates transactions. A **receipt PDF/image** supports a purchase and never becomes bank activity by itself. Every document remains private and unavailable until security validation succeeds.

If Plaid is unavailable, choose manual import without losing earlier setup. Plaid authentication happens only inside Plaid Link. Capture Tracker requests read-only Transactions access and never collects a bank password or enables payments, transfers, Auth, or money movement.

## Bank activity: automatic or manual

The owner chooses an activity method for each business financial account. **Automatic sync** uses an optional read-only Plaid connection. **Manual import** uses transaction CSV files downloaded from the bank or card provider. Both choices are supported equally and can coexist across different accounts.

Plaid activity and CSV activity enter the same duplicate checks and review queue. Capture Tracker never automatically posts either source. The owner approves accounting categories, and posted journals remain immutable if later provider evidence changes or disappears.

To connect, open **Money → Bank**, choose **Connect bank** for the intended Capture Tracker account, then complete institution authorization inside Plaid Link. Select business accounts only and map each selected Plaid account to one Capture Tracker financial account. If the institution later requests access again, use **Reconnect bank** on the existing connection rather than adding a duplicate.

To work manually, download a **transaction CSV**, open **Money → Import**, preview it, confirm it, review exceptions, and reconcile it against the statement. Upload a statement PDF/image through Documents if you want retained statement evidence; that document does not create transactions.

> **Current product note:** Plaid Transactions and manual CSV are both available per business account. Both sources use duplicate checks and the same owner review boundary. Invoices and Bills record owner-confirmed receivables and payables. Owner Money keeps salary, distributions, reimbursements, contributions, and shareholder loans distinct. Payroll and fixed-asset tax treatment remain review items where evidence is incomplete.

**SPENDING TRACKED. BUSINESS GROWN.**

Private customer guide - Customer Onboarding 2.0

> **Private customer boundary.** Capture Tracker organizes recorded financial facts. It is not a CPA, does not file taxes or send payments, does not run payroll, manage inventory, or offer public self-service signup. New workspaces require an operator-created invitation. Uploaded PDF, JPEG, and PNG files stay private and are security-scanned before they become available.

## Start here — how to run your books

Use Capture Tracker by time horizon, not by memorizing features: capture receipts, invoices, bills, and mileage as they happen; open **Run My Books** once a week; reconcile and close once a month; keep occasional Owner & S-Corp workpapers current; and use **Year-End Flight Check** for CPA handoff. Today always surfaces the current next action.

Use the private workspace URL supplied by the operator. New owners receive a one-time, email-bound invitation that expires after 72 hours. There is no public signup. Create or sign into the invited account, accept the link, and follow the saved setup checkpoint. Contact support if account recovery is unavailable. Sign out when using a shared device.

## Navigation

Desktop navigation keeps **Today, Money, Documents, Reports**, and **Run My Books** prominent. Less-frequent monthly, Owner & S-Corp, professional accounting, help, and settings destinations are grouped behind **More**. On phones, the primary bar remains **Today, Money, Documents, Reports, More**. The global **+ New** launcher groups Money in, Money out, Capture, Owner, and Import actions. Finder remains a secondary escape hatch. CPA read-only users do not receive owner mutation actions.

## Today — the decision briefing

Today is the owner command screen, not a report dashboard. It answers whether the books are current, what needs the owner, what to do next, and which frequent activity to record. **Run My Books** is the dominant weekly action. Four visible capture actions handle invoices, bills, receipts, and mileage; less-frequent owner/import actions remain in + New. Today never moves money or changes accounting.

## Money — record and review financial activity

Money is where transactions are entered, classified, searched, filtered, and reviewed. Use **Add transaction** to choose the financial account, date, description, amount, intent (income, expense, contribution, distribution, or mixed activity), category, and optional notes. A saved transaction creates a posted balanced journal entry. Business expenses affect business reporting; owner distributions are equity movements, not deductible expenses. Mixed transactions require a deliberate split whose total must equal the parent amount.

Use the transaction list to filter by review status, intent, or account and to open a transaction. Posted accounting is preserved: fix a mistake with the supported correction/reversal or replacement workflow rather than erasing history. A reversal preserves the original event and avoids a duplicate economic effect.

## Documents — supporting evidence

Documents holds private, business-scoped evidence. Upload **PDF, JPEG, or PNG** files only, up to **10 MiB**. Mobile browsers can offer **Take photo** with the rear camera. Camera photos are normalized on your device before upload to keep a readable receipt smaller; PDF files are unchanged. Review the preview, then upload; duplicate detection is based on file content.

> **Security scan.** After upload, the document remains private and unavailable while it is queued and scanned. The status refreshes automatically. Only a **Ready** document that passed the security scan can be opened, used for extraction/matching, or treated as document evidence. A scan failure leaves it unavailable; a rejected file cannot be used. Do not retry an identical rejected file under another name.

Once a document is Ready, the workspace shows validation, extraction, match, and link states. Suggestions and extracted values require review and never alter accounting automatically. Open a document to review protected metadata, extraction candidates, transaction links, and available actions. Remove is available only where the document has no protected accounting relationship; removal revokes access immediately.

## Reports — complete totals, readable detail

Choose a reporting period, then view Profit and Loss, Balance Sheet, Trial Balance, or Cash Activity. Report totals use complete database-backed accounting data. Supporting detail can be paginated for readability; pagination never makes totals partial.

- **Profit and Loss:** business income and business expenses for the selected period.
- **Balance Sheet:** assets, liabilities, and equity at the reporting date.
- **Trial Balance:** debit and credit balances; total debits and credits should match.
- **Cash Activity:** opening cash, money in, money out, net change, and ending cash.

Use **Export CSV** for the selected period when available. Exports are suitable for spreadsheets and protect against formula-like cell content. A large export may be safely refused rather than returned partially. The owner can also use **Download CPA package** for a ZIP of accounting schedules and a PDF index; it contains no private document bytes or storage links.

## Taxes — planning facts, not filing

Taxes presents the current tax year and quarter, ledger business income, salary expense, owner distributions, recorded estimated-tax payments, payroll facts, projected obligation, quarterly estimate remaining, reserve status, and missing inputs. Open estimate history to review an estimate and recorded payments made elsewhere; use Payroll summary and Owner compensation for factual review of wages, payroll taxes, and distributions. Payroll bank evidence remains unresolved when it is missing, partial, or different. To correct a processed payroll result, use the owner-confirmed reversal control; it posts an opposite linked journal and preserves the original record. Capture Tracker does **not** file returns, submit tax payments, process payroll, determine an IRS-approved salary, or replace a CPA.

## Run My Books and reconciliation

Run My Books assembles only relevant unresolved work across Transactions, Receipts & Documents, Money Coming In, Money Going Out, Owner Money, Payroll, Reconciliation, and Periodic Review. It shows factual “Step X of Y” progress and skips irrelevant groups. Completion records acknowledgement and history; it does not hide unresolved problems or post accounting entries.

Reconciliation compares a financial account’s statement-ending balance with the cleared book balance. Review statement activity and candidate matches, approve or reject only a safe match, leave uncertain items unresolved, save the selection, and finalize only at an exact $0.00 difference. Matching does not create another transaction or journal effect. A completed reconciliation is preserved as evidence.

## Fixed assets, close, and CPA handoff

Use **Taxes → Fixed assets** to record a possible business asset and its supporting facts. An owner can confirm the placed-in-service fact after review. That does not choose depreciation, capitalization, useful life, or tax treatment, and it does not create a depreciation journal; take those unresolved items to a CPA.

Month-end translates deterministic blockers into owner language and links each one directly to its protected workflow before explicit close confirmation. Year-End Flight Check guides Books, Owner Money, Payroll, Basis, Benefits, Fixed Assets, CPA Review Items, and CPA Package. The final state is **READY FOR CPA**, not tax-return readiness. The tenant-scoped package excludes receipt bytes and storage links.

## Activity and Settings

Activity is the read-only, business-scoped history of transactions, corrections and reversals, documents, reconciliation, tax-payment records, Run My Books acknowledgements, settings, exports, and relevant timestamps. Use filters and record links to investigate what happened.

Settings currently supports default report period, Run My Books review day (0–6), and document-retention target (12–120 months). Save after valid values are entered. Settings changes appear in Activity; if a concurrent update wins, refresh before saving again.

## Practical workflows

Use **+ New** or **Find** from any authenticated screen when you know the task but not its route. The launcher uses owner language only and every destination retains its existing server-side authorization.

**Create an invoice:** Today → Create invoice, + New → Create invoice, or Money → Money coming in → Invoices.

**Add a bill:** Today → Add bill, + New → Add bill, or Money → Money going out → Bills.

**Record mileage:** Today → Record mileage, + New → Record mileage, or Money → You & the company → Mileage.

**Business purchase:** Money → Add expense → choose category → Documents → take/upload receipt → review and link → Reports.

**Business income:** Money → Add income → save → Reports.

**Receipt photo:** Documents → Take photo → permit the camera → review preview → upload → wait for **Security scan pending** to refresh to **Ready** → Open or link to the transaction.

**Fix or reverse a transaction:** Open the transaction → choose the supported correction or reversal → confirm the explanatory history and replacement record where applicable.

**Prepare for a CPA:** complete Run My Books, resolve or note document attention, inspect Reports and Owner & S-Corp workpapers, download the CPA package or export needed CSV, and provide unresolved questions separately.

## Mobile browser access

Open the production URL supplied by the owner in Safari or Chrome. On iPhone Safari, use Share → **Add to Home Screen**; on Android Chrome, use the menu → **Add to Home screen**. This creates a browser shortcut, not an App Store or Play Store app, and it does not promise offline operation. Allow camera permission only when photographing a trusted receipt. Confirm you are on the production URL before entering business data; staging and local demo environments are for fictional data only.

## Troubleshooting

| Situation | Safe action |
| --- | --- |
| Cannot sign in / session expired | Re-enter the supplied URL and credentials; contact the workspace owner if it persists. |
| Create account is absent | The private workspace is initialized; request owner-managed access. |
| Validation or duplicate submission | Correct highlighted values; wait for the first save to finish and refresh before retrying. |
| Security scan pending | Keep the page open briefly; status refreshes automatically. If it remains pending unusually long, contact the workspace owner rather than treating the file as usable. |
| File rejected, scan could not complete, or duplicate | Use PDF/JPEG/PNG under 10 MiB; do not re-upload an identical rejected or duplicate file. A failed scan remains private and unavailable. |
| Camera does not open | Allow browser camera permission, use HTTPS, or select an existing trusted file. |
| Document will not open | Confirm you are signed in and the document is active; contact support if protected access still fails. |
| Review task remains | Fix the linked record; completing Run My Books alone does not clear it. |
| Reconciliation will not finalize | Resolve selection/matches until difference is exactly $0.00. |
| Report has no activity / CSV is refused | Check the period; large exports may be refused safely. |
| Settings conflict or phone layout issue | Refresh, then retry; update the browser or use its normal zoom. |

## Owner Money S-Corp workpapers

Open **Taxes → Owner money → S-Corp workpapers** to organize factual evidence for opening stock and debt basis, categorized workpaper adjustments, distinct shareholder debt instruments, readiness snapshots, reimbursement/accountable-plan policy versions, and greater-than-2% shareholder health-insurance workpaper facts. Stock basis, tax debt basis, book equity, and book loan balances remain separate.

Unknown opening amounts show **BASIS WORKPAPER INCOMPLETE**; Capture Tracker never replaces them with $0. Distribution readiness is an operational state—**Ready for owner review**, **Review recommended**, **Blocked by bookkeeping**, or **CPA review recommended**—not a tax-free amount, IRS approval, or safe-distribution conclusion. Health-insurance entries record factual coverage and payroll/W-2 workpaper state without filing or changing payroll-provider records.

Open a posted transaction to use **Explain this transaction**. Its deterministic evidence chain shows source activity, linked documents, classification/rule/policy evidence where available, approval timing, journal debits and credits, corrections or reversals, and audit events. It is not an AI explanation.

## Security, privacy, and glossary

The workspace is private and authenticated. Passwords are not displayed in the product. Data and documents are scoped to the business. New documents are quarantined and ClamAV-scanned privately before ACTIVE + CLEAN-only protected access; signed document access rechecks the current state. Accounting history uses corrections/reversals instead of destructive editing. Operational backups are encrypted; use normal sign-out practice on shared devices.

**Available Business Cash** is approved business cash, excluding personal accounts and credit cards. **Income** is business money received; a **Business Expense** is a business cost. An **Owner Contribution** adds owner equity; an **Owner Distribution** removes owner equity. A **Mixed Transaction** contains deliberate business/personal treatment. A **Category** classifies activity. A **Posted Transaction** has a balanced **Journal Entry**, where **Debit** and **Credit** totals match. A **Correction**, **Reversal**, or **Replacement Transaction** preserves history while fixing a mistake. A **Document** is evidence; a **Document Match** is a reviewed suggested relationship. **Run My Books** is the grouped owner-attention routine. **Reconciliation** compares book and **Statement Activity**. A **Tax Estimate** is planning information. **Salary** and **Distribution** are distinct factual records. **Profit and Loss**, **Balance Sheet**, **Trial Balance**, and **Cash Activity** are the reports above. **Activity History** is the immutable record of material workspace events.

## Documentation provenance

Any retained documentation images use repository-provided fictional demo data or unauthenticated public pages only; no production workspace, credential, client data, object key, or internal identifier is used.

## Customer setup checklist

- Open only the private invitation intended for your email.
- Use a password manager and never share the invitation or password.
- Confirm the S-Corp name and the date Capture Tracker starts keeping the books.
- Add only business bank and credit-card accounts.
- Choose Plaid or manual CSV independently for each account.
- Keep the statement or other source supporting every opening balance.
- Leave uncertain Owner Money, payroll, asset, or basis facts in Needs review / CPA review.
- Review imported activity before approving any category.
- Reconcile the first statement to exactly $0.00 without a plug.
- Finish the tour, then use Today and Run My Books for the normal routine.

## Getting help safely

Use the in-product feedback or support path for a blocked setup step. Describe the step and the visible, non-sensitive error. Never send a password, bank credential, invitation token, Plaid token, account number, tax identifier, document contents, or production financial values through chat or ordinary email.
