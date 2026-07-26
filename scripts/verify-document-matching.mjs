import { readFileSync } from "node:fs";

function check(path, snippets) {
  const source = readFileSync(path, "utf8");
  for (const snippet of snippets) if (!source.includes(snippet)) throw new Error(`${path} is missing matching integrity control: ${snippet}`);
}

check("prisma/migrations/20260726110000_document_transaction_matching/migration.sql", ["DocumentMatchRun_active_evidence", "DocumentMatchSuggestion_score_range", "DocumentMatchSuggestion_decision_integrity"]);
check("src/lib/documents/transaction-matching-core.ts", ["reviewedEvidence", "linkDocumentToTransactionInTransaction", "transactionVersion", "documents: { none", "take: 100"]);
check("src/lib/documents/transaction-matching-provider.ts", ["local-reviewed-rules", "EXACT_AMOUNT", "MERCHANT_MATCH", "addCent"]);
if (readFileSync("src/lib/documents/transaction-matching-provider.ts", "utf8").includes("BigInt(")) throw new Error("The matching provider must not use JavaScript floating-point or BigInt persistence conversions.");
console.log("DOCUMENT MATCHING VERIFICATION PASSED");
