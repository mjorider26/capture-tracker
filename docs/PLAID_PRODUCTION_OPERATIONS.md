# Plaid production operations

## Source-independent readiness

Required runtime values:

| Value | Storage | Requirement |
| --- | --- | --- |
| `PLAID_ENV` | Worker variable | `production` for the production Worker; `sandbox` for fictional tests |
| `PLAID_CLIENT_ID` | Worker secret | Server only |
| `PLAID_SECRET` | Worker secret | Server only; environment-specific |
| `PLAID_TOKEN_ENCRYPTION_KEY` | Worker secret | Base64-encoded 32 random bytes; separate from database and Plaid credentials |
| `PLAID_TOKEN_KEY_VERSION` | Worker variable | Positive integer; starts at `1` |
| `PLAID_WEBHOOK_URL` | Worker variable | Production `/api/plaid/webhook` HTTPS URL |
| `PLAID_REDIRECT_URI` | Worker variable | Exact production `/app/money/bank` HTTPS URL; register in Plaid |

Never place secret values in Git, chat, screenshots, shell output, logs, local customer files, or documentation. Use `wrangler secret put NAME --config wrangler.production.jsonc` interactively. Generate the encryption key in an approved secret-management context; do not reuse `BETTER_AUTH_SECRET`.

## Trial and billing boundary

Sandbox uses fictional data and should be the normal development/test environment. Do not consume a real Trial Production Item for engineering tests. A real connection is a later customer/owner acceptance step through Plaid Link only.

This implementation requires no paid Plaid upgrade. Do not submit a paid/full-production application, accept a pricing commitment, or enter billing details without separate owner approval. Plaid plan availability and institution access must be rechecked in the dashboard at acceptance time.

## Pre-release gate

1. Confirm the intended source commit and clean worktree, excluding the known untracked nested workspace.
2. Review the additive migration; never reset production.
3. Pass Prisma validation/generation, tests, integration/accounting checks, lint, Next build, secret/data-boundary checks, Cloudflare build/bundle/runtime checks, and exact-SHA CI.
4. Confirm secret names exist without reading their values.
5. Confirm Plaid dashboard redirect URI and webhook URL exactly match production.
6. Confirm production release authorization for the exact source SHA.
7. Take the standard production logical backup and run the normal migration/deploy workflow.

## Supported smoke checks

Before any real Item, verify the production Bank Connections screen loads, manual CSV remains available, non-owners are read-only, and unsigned webhook POSTs receive `401` without creating an event.

After explicit real-connection approval, the owner connects one intended business institution through Plaid Link, selects only business accounts, maps each selected account, runs sync, and verifies activity enters review without a journal. Do not ask for or observe institution credentials. Do not connect Customer #001 during development.

## Incident response

- Provider outage: leave Items/history intact; tell customers manual transaction CSV remains available.
- Reconnect required: use Link update mode. Do not create a duplicate Item.
- Suspected Plaid secret exposure: rotate in the Plaid dashboard and Worker secret store; do not print the old or new value.
- Suspected token-encryption key exposure: disable connection operations, preserve the database, rotate using an explicitly designed re-encryption procedure before advancing `PLAID_TOKEN_KEY_VERSION`. Do not change the version while old envelopes remain.
- Webhook verification failures: inspect sanitized counts/status only. Never log headers or raw bodies.
- Disconnect failure: retain the encrypted token and Item state until Plaid confirms `/item/remove`; customers can switch financial accounts to manual CSV meanwhile.

Rollback the application with the documented production rollback process. The additive columns/tables remain backward compatible; do not drop them or delete provider/accounting history during rollback.
