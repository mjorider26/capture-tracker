# Weekly Review and reports

Weekly Review is a short, actor-bound acknowledgement workflow. It shows business-scoped transaction, document, suggested-match, reconciliation, tax, and payroll attention counts. Completion stores only the review state, optional safe note, unresolved count, and immutable history; it never changes accounting records or claims that outstanding work disappeared. A completed session can be reopened while retaining its prior history.

Financial reports are calculated from posted journal lines, not transaction UI summaries. Profit and Loss uses period income and expense postings. The Balance Sheet is as-of the selected end date and displays its equation difference. Trial Balance displays debit and credit totals and its difference. Cash Activity is a cash-account roll-forward and is not presented as a formal GAAP cash-flow statement. Report rows offer bounded links to supporting journal entries.

Date ranges are server-validated, capped at two years, and use UTC day boundaries for the ledger dates stored in this repository. CSV export is authenticated, business-scoped, formula-injection-safe, and contains report rows only — never private-document URLs or storage data. A future read-only Ask AI surface may consume these same report services, but may not mutate books.
