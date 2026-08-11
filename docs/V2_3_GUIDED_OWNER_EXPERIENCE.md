# V2.3 Guided Owner Experience

V2.3 organizes the authenticated product around owner intent while preserving all existing accounting, authorization, document, audit, and tenant boundaries. No schema change is required.

## Owner intent model

- **Get my books current:** transaction review, documents, matching, reconciliation, Weekly Review, and Books Current Through.
- **Get paid:** customers, invoices, receivables, incoming payment evidence, and AR.
- **Pay what I owe:** vendors, bills, payables, due dates, outgoing payment evidence, and AP.
- **Me & my S-Corp:** salary, distributions, reimbursements, contributions, shareholder loans, mileage, basis, and benefits.
- **See how my business is doing:** Profit & Loss, Balance Sheet, cash/activity context, AR, and AP.
- **CPA / year-end:** reconciliation status, workpapers, Year-End Flight Check, read-only CPA access, and CPA package.

## Exact owner paths

| Task | Guided paths |
| --- | --- |
| Create invoice | `Today → Create invoice`; `+ New → Create invoice`; `Money → Money coming in → Invoices`; `Find → Create invoice` |
| Add bill | `Today → Add bill`; `+ New → Add bill`; `Money → Money going out → Bills`; `Find → Add bill` |
| Upload receipt | `Today → Add receipt`; `+ New → Upload receipt`; `Documents → Upload document`; `Find → Upload receipt` |
| Record mileage | `Today → Record mileage`; `+ New → Record mileage`; `Money → You & the company → Mileage`; `Find → Record mileage` |
| Owner Money | `Today → Owner Money`; `Money → You & the company → Owner Money`; `Find → Owner Money` |
| Profit & Loss | `Reports → How is my business doing? → Profit & Loss`; `Find → Profit & Loss` |
| Reconciliation | `Money → Accounts & activity → Reconciliation`; `More → Reconciliation`; `Find → Reconciliation`; actionable Books Current Through blocker |
| CPA access | `Money → You & the company → CPA access`; `Reports → CPA / year-end → CPA access`; `Find → Manage CPA access` |
| Year-end | `Reports → CPA / year-end → Year-End Flight Check`; `Taxes → Year-end`; `Find → Year-End Flight Check` |

The global **+ New** launcher is owner-only and contains curated business workflows. Finder is deterministic route/action metadata and filters owner mutations from `CPA_READ_ONLY`. It does not search customer financial data.

## Deep-workflow handoffs

- Invoices link to AR Aging and possible payment activity.
- Bills link to AP Aging and possible vendor-payment activity.
- Mileage links to Owner Money reimbursement work and the reimbursement summary.
- Reconciliation remains tied to exact-zero statement evidence and Books Current Through.
- Year-End links to reconciliation, reimbursements, S-Corp workpapers, and CPA-package preparation.

Production release remains a separate owner-authorized action after exact-SHA CI is green.
