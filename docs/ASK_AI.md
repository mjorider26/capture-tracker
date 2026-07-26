# Read-only Ask AI

Ask AI is a business-scoped, read-only explanation surface. It persists only conversations, messages, runs, evidence references, feedback, and immutable audit events. It cannot call mutation services or receive a Prisma client; its trusted registry returns bounded structured facts from reports, Weekly Review, transactions, documents, reconciliation, tax, and payroll summaries.

The current adapter is deterministic, local, and fictional. It makes no network calls and fails closed in production or when real-data approval is enabled. No provider, model, SDK, endpoint, credential, or cloud resource is configured. Provider selection remains a separately approved production decision.

Business descriptions, merchant names, document names, notes, and extraction values are untrusted data: they are normalized and bounded, never interpreted as instructions. Answers are validated against known evidence aliases before persistence. Financial amounts come only from ledger-backed reports, include an as-of timestamp, and old answers remain historical; asking again creates a new run and evidence set. Ask AI does not provide legal, tax, investment, or accounting advice.
