# Plaid bank connections

## Customer choice

Bank activity is configured per business financial account:

- **Automatic sync** uses a customer-authorized Plaid Item for read-only Transactions data.
- **Manual import** uses a bank or card transaction CSV whenever the owner chooses.

Both methods enter the same `ExternalTransaction` review pipeline. Neither method posts accounting automatically. The owner can switch a financial account between methods without rewriting imports, decisions, reconciliations, transactions, journals, or audit events.

Manual routine:

1. Download a transaction CSV from the bank or card provider.
2. Open **Money → Import**.
3. Preview and confirm the transaction import.
4. Review anything needing attention.
5. Reconcile against the statement.
6. Run My Books.

A PDF or image statement belongs in Documents and does not create transactions.

## Provider scope

Capture Tracker requests Plaid's `transactions` product only. It does not request Transfer, Auth, payment-initiation, or money-movement products. Link is optional and remains owner-initiated. Capture Tracker does not render a bank credential form; institution authentication occurs in Plaid Link.

Stored provider data is limited to Item and account identifiers, institution identity, account display metadata/mask, sync cursors, normalized transaction evidence, sanitized errors, signed-webhook delivery evidence, and an encrypted access-token envelope. Raw webhook bodies, Link public tokens, Plaid secrets, and institution credentials are not persisted or logged.

## Lifecycle

- Initial Link: owner requests a server-created Link token; Link returns a short-lived public token; the server exchanges it and encrypts the access token before storing the Item.
- Sync: `/transactions/sync` is fully paginated before the new cursor is committed. Mutation-during-pagination restarts from the original cursor.
- Updates: added, modified, removed, redelivered, and pending-to-posted activity are idempotent. Provider changes never rewrite a posted transaction or journal.
- Webhooks: the maintained `jose` library verifies the ES256 JWT against Plaid's JWK; five-minute `iat`, exact SHA-256 raw-body hash, and signed-delivery replay uniqueness are then enforced before Item lookup. Tenant context is resolved from the stored provider Item id, never from a client or webhook business id.
- Reconnect: update mode reuses the stored Item/access token. Do not create a second Item for the same institution/account.
- Account pause: stops normalization for one Plaid account but does not disconnect the Item.
- Disconnect: `/item/remove` must succeed before the encrypted token is erased. History is preserved and mapped financial accounts return to manual import.

## Duplicate policy

Plaid Item duplication is conservatively blocked using the provider Item id and, before persistence, matching institution id plus account name and mask. A mask is display metadata and is never treated as a full account number.

Across Plaid and CSV, exact provider identities and exact normalized fingerprints are duplicates. Matching date, amount, direction, and normalized merchant is a **possible duplicate** that requires owner review. Uncertainty is not silently discarded.

## Failure behavior

`ITEM_LOGIN_REQUIRED` and pending disconnect states become **Needs attention** with an owner reconnect action. Other provider failures retain history and keep manual CSV available. Webhooks trigger idempotent evidence sync only; they do not post, delete, pay, transfer, or make an accounting decision.

## Privacy/legal review flag

Before the first real Production Item, the owner should confirm that the public privacy notice accurately identifies Plaid as a third-party financial-data provider and links any provider disclosure considered appropriate by legal/product review. This document is a factual technical inventory, not legal language.
