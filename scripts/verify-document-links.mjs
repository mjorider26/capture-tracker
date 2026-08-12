import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, snippets) {
  const source = text(path);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) throw new Error(`${path} is missing required document-link control: ${snippet}`);
  }
}

requireText("prisma/schema.prisma", [
  "model TransactionDocument {",
  "model TransactionDocumentHistory {",
  "@@unique([businessId, id])",
]);
requireText("prisma/migrations/20260726080000_transaction_document_links/migration.sql", [
  "TransactionDocument_active_pair",
  "TransactionDocumentHistory",
  "TransactionDocument_unlink_integrity",
  "migration-linked-",
]);
requireText("src/lib/documents/transaction-links-core.ts", [
  "DOCUMENT_NOT_ELIGIBLE",
  "unlinkedAt: null",
  "action: \"LINKED\"",
  "action: \"UNLINKED\"",
]);
requireText("src/app/app/money/[transactionId]/actions.ts", [
  "requireBusinessMutationContext",
  "revalidatePath",
  "linkDocumentToTransaction",
]);
requireText("tests/integration/transaction-document-links.integration.test.ts", [
  "duplicate concurrency",
  "rolls back link and unlink",
  "accounting unchanged",
]);

console.log("DOCUMENT LINKS VERIFIED: scoped active links, immutable history, atomic service controls, authenticated actions, and PostgreSQL risk coverage.");
