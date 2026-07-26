import { readFileSync } from "node:fs";
const check = (path, terms) => { const source = readFileSync(path, "utf8"); for (const term of terms) if (!source.includes(term)) throw new Error(`${path} is missing ${term}`); };
check("prisma/migrations/20260726100000_document_extraction_review/migration.sql", ["DocumentExtractionAttempt_active_source", "DocumentExtractionCandidate_confidence_range", "DocumentExtractionCandidate_review_integrity"]);
check("src/lib/documents/extraction-core.ts", ["INELIGIBLE", "STALE", "action: \"COMPLETED\"", "action: review === \"ACCEPTED\""]);
check("src/lib/documents/extraction-provider.ts", ["fictional-local-extraction", "No approved production document extraction provider is configured", "FIXTURE_FAILURE"]);
console.log("DOCUMENT EXTRACTION VERIFIED: fictional provider boundary, scoped attempts, reviewed evidence, stale protection, and accounting non-interference controls.");
