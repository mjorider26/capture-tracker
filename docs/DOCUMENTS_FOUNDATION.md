# Documents foundation — Phases 10A–10B

> **SUPERSEDED / HISTORICAL**
>
> This document describes earlier Capture Tracker implementation states and must not be used as the current production operations source of truth. See [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

Phase 10A retains fictional metadata-only document records. Phase 10B adds a local-fictional secure upload workflow for PDF, JPEG, and PNG files up to 10 MiB. It is not approved for real documents, staging, or production.

The upload service derives MIME type from file signatures, computes an actual-byte Web Crypto SHA-256, and uses the existing per-business hash uniqueness constraint as the final duplicate authority. The same bytes can be stored by different businesses. A temporary private object is promoted before the visible database state is committed; a losing concurrent request removes only its own opaque key, and a failed database write attempts compensation cleanup. Local objects live under the ignored `.document-storage/` root using opaque random keys and are never returned to the browser.

Clean fictional scans create `ACTIVE` / `STORED_PRIVATE` records with `CLEAN` status and allow private reads. Suspicious scans create `QUARANTINED` / `QUARANTINED_PRIVATE` records and no read eligibility. A deterministic scanner-error marker leaves a `PENDING_VALIDATION` / `PENDING_STORAGE` record inaccessible. Production and real-data approval both fail closed before local storage can run.

Private content requires normal authenticated business resolution plus a compact HMAC grant bound to actor, business, document, and a five-minute expiry. The content route then rechecks business scope, active status, clean scan state, private-storage state, and read eligibility before serving bytes. It uses private no-store, no-sniff, no-index, and restrictive framing headers. Pending and quarantined records have no preview or download. Tokens contain no object key and no permanent public URL is generated.

The repository includes an inactive Worker-compatible R2 adapter boundary using only a future R2 binding contract. It supports pending/active/quarantine namespaces, private puts/gets/heads, copy-and-delete promotion with compensation, and cleanup. There is no real binding, bucket name, account ID, key, provider call, or public URL; it fails closed when the binding is absent.

The retention target remains seven calendar years from the document date (or creation baseline), not legal or tax advice.

## Phase 10C — transaction links

Documents and transactions are related through append-only relationship rows. Each relationship has a stable ID, actor, link timestamp, optional unlink metadata, and immutable `LINKED` / `UNLINKED` history. PostgreSQL enforces one active relationship for a `(businessId, transactionId, documentId)` pair with a partial unique index. Unlinking closes that relationship without deleting document bytes or the transaction; relinking creates a new relationship and a new `LINKED` event, retaining all earlier rows and events.

Both foreign-key paths use the business ID as part of their composite keys, so a relationship, actor, history event, document, and transaction cannot cross a business boundary. Only active, clean, privately stored, read-eligible documents may be newly linked. Detail selectors are business-scoped and capped at 50 records; they never return storage keys, local paths, or permanent URLs.

Authenticated document and Money detail pages can link, unlink, and relink. Linked-document opens reuse the existing five-minute actor/business/document-bound private read grant; no new public URL or browser storage access is introduced. Link changes do not mutate transactions, journal entries, journal lines, accounts, reconciliation state, or accounting values.

The deterministic fictional demo includes a receipt link, a transaction with two documents, a clean active unlinked document, a document shared by two transactions, and a preserved unlink/relink history. It includes no uploaded binary files. OCR, extraction, automatic matching, AI suggestions, email ingestion, retention deletion, provider activation, deployment, and real-document use remain out of scope.

## Phase 10D — extraction review

Active, clean, privately stored PDF, JPEG, and PNG documents can receive a business-scoped extraction attempt tied to their exact SHA-256 and object-version identity. A provider-neutral interface currently exposes only a deterministic, no-network fictional local adapter. Production and real-data-approved execution fail closed because no production provider, credential, endpoint, or SDK is configured.

Attempts, structured candidates, and actor-aware extraction/review history are immutable evidence. Candidates retain original text, safe normalization, bounded confidence, and optional page/source references. A human may accept, correct, or reject an unreviewed candidate; corrections use the same field validation. Changed source identity makes an attempt stale and blocks review. Extraction never writes transactions, links, journal entries, accounts, reconciliation, tax, payroll, or owner-compensation records. Automatic matching and Ask AI remain future, review-gated work.

## Phase 10E — reviewed transaction suggestions

Phase 10E adds a local deterministic rules engine that can suggest — but never automatically create — a transaction-document relationship from current, accepted or corrected extraction evidence. It uses exact decimal-string money comparisons, a bounded 31-day date query, normalized merchant/description similarity, matching business currency, and safe reference matches. The resulting integer Match strength is an explanation aid, not a claim of certainty; each suggestion retains its reason codes.

Runs are bound to the active document's SHA-256/object version, the completed extraction attempt, and a reviewed-evidence fingerprint. Changes to source identity, reviewed evidence, document availability, a suggested transaction's facts, or an existing link make a suggestion stale and block approval. Runs, suggestions, and immutable generated/decision/link history are business-scoped with composite foreign keys and database score, rank, and decision-state checks.

An explicit human approval calls the existing Phase 10C link service in the same transaction. It does not duplicate link rules and may only create the ordinary active relationship with a history note that it came from a reviewed suggestion. Rejection and dismissal are idempotent decisions. Generation, approval, rejection, and dismissal never mutate transaction facts, accounts, splits, journals, reconciliation, taxes, payroll, compensation, or balances. The local rules interface is provider-neutral; a future AI-enhanced matcher requires separate approval and remains outside this phase.
