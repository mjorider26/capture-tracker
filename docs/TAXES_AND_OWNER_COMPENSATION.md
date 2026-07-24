# Taxes and owner compensation

Phase 8 exposes only business-scoped, stored financial facts on authenticated `/app/taxes/*` routes and the locally restricted `/demo/taxes/*` equivalent. It never initiates a payment, files a return, supplies tax-law constants, determines compliance, or concludes whether owner compensation is reasonable.

## External payment records

Tax payments are recorded as immutable external facts. Estimate detail pages label every row `Recorded payment`, show the payment date, exact amount, recorded timestamp, and a reference or note when recorded, and state: `Recorded externally; no payment was initiated by Capture Tracker.` They never reveal idempotency keys, internal IDs, edit/delete controls, or database errors.

Each submission receives a browser-generated UUID-style key. The nullable `(businessId, estimateId, idempotencyKey)` PostgreSQL unique index preserves historical NULL keys, blocks duplicate scoped non-NULL keys, and permits the same key for another business or estimate. The shared authenticated/demo service returns a precise contract:

- `RECORDED` for a new external record;
- `ALREADY_RECORDED` for an exact replay, without a second payment, version change, or audit event;
- `IDEMPOTENCY_CONFLICT` when that key carries changed facts;
- distinct stale and future expected-version results;
- validation, authorization, and safe generic failure states.

All successful records and the matching audit event commit together. The service opens one interactive database transaction, creates `SAVEPOINT payment_insert`, and attempts the insert. A named-composite-index uniqueness failure rolls back only to that savepoint so the same transaction can compare the existing payment facts and return the exact replay or mismatch result. A successful insert continues to the conditional version update and audit append in that same enclosing transaction. If the version gate affects zero rows, the transaction aborts and rolls back the newly inserted payment row as well as the audit work. A preliminary insert in a separate transaction would be unsafe because a later version failure could orphan the payment. The full-PostgreSQL exercise proves fresh-key stale and future version requests leave zero payment rows for those keys, with no estimate or audit mutation. The database unique index is the duplicate-prevention authority, not optimistic locking.

## Payroll, distributions, and CPA boundary

Payroll pages show only processed-run facts: pay dates and periods, gross wages, withholding, employer payroll taxes, net pay, run count, year-to-date totals, and latest payroll date. Owner Compensation keeps payroll and paid owner distributions distinct, shows combined recorded cash, factual counts and dates, and identifies missing CPA-review facts. It does not recommend a salary, perform market comparisons or shareholder-basis calculations, treat distributions as expenses, or claim compliance.

The following notice is persistently visible near the top of Taxes Overview and Owner Compensation: `Capture Tracker organizes recorded financial facts and highlights items for review. It does not determine legal compliance or reasonable compensation. A CPA or qualified tax professional must make that determination.`

Safe-harbor readiness uses stored facts only. It can report not configured, a current estimate with a formal test unavailable, or that a CPA estimate is authoritative; it never embeds remembered percentages, thresholds, brackets, penalty formulas, due dates, or state rules. Projected tax obligation, quarterly estimates, and recorded payments remain separate values.

Local environments contain fictional data only. Phase 9 cloud production foundations and the real-data boundary are mandatory before real-client onboarding or financial-data access.
