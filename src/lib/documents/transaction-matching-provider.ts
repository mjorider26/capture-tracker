import { createHash } from "node:crypto";

export type ReviewedEvidence = {
  amount?: string;
  date?: string;
  merchant?: string;
  currency?: string;
  description?: string;
  identifier?: string;
  paymentMethod?: string;
  maskedAccountReference?: string;
};

export type MatchableTransaction = {
  id: string;
  amount: string;
  postedAt: Date;
  description: string;
  merchantName: string | null;
  sourceReference: string | null;
};

export type MatchResult = { score: number; reasons: string[] };
export type TransactionMatchingProvider = {
  id: string;
  version: string;
  score(evidence: ReviewedEvidence, transaction: MatchableTransaction, businessCurrency: string): MatchResult;
};

function cents(value: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}${fraction.padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
}
function addCent(value: string) { const digits = value.split(""); let carry = 1; for (let index = digits.length - 1; index >= 0 && carry; index -= 1) { const next = digits[index].charCodeAt(0) - 48 + carry; digits[index] = String(next % 10); carry = next >= 10 ? 1 : 0; } return `${carry ? "1" : ""}${digits.join("")}`; }
function normalized(value: string | null | undefined) { return (value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim(); }
function dateParts(value: string | Date) { const date = typeof value === "string" ? value : value.toISOString(); return date.slice(0, 10); }
function dateDistance(left: string, right: string) { return Math.abs(Date.parse(`${left}T00:00:00.000Z`) - Date.parse(`${right}T00:00:00.000Z`)) / 86_400_000; }
function similar(left: string, right: string) {
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const a = new Set(left.split(" ").filter((word) => word.length > 2)); const b = new Set(right.split(" ").filter((word) => word.length > 2));
  let shared = 0; for (const word of a) if (b.has(word)) shared += 1;
  return shared > 0 && shared / Math.max(a.size, b.size) >= 0.5;
}

export function fingerprintReviewedEvidence(attemptId: string, sourceSha256: string, sourceObjectVersion: string | null, values: Array<{ id: string; fieldType: string; value: string }>) {
  const canonical = values.sort((a, b) => a.id.localeCompare(b.id)).map((value) => `${value.id}:${value.fieldType}:${value.value}`).join("|");
  return createHash("sha256").update(`${attemptId}|${sourceSha256}|${sourceObjectVersion ?? ""}|${canonical}`).digest("hex");
}

export function createLocalTransactionMatchingProvider(): TransactionMatchingProvider {
  return {
    id: "local-reviewed-rules", version: "1",
    score(evidence, transaction, businessCurrency) {
      const reasons: string[] = []; let score = 0;
      const total = evidence.amount ? cents(evidence.amount) : null; const amount = cents(transaction.amount);
      if (total !== null && amount !== null) { if (total === amount) { score += 45; reasons.push("EXACT_AMOUNT"); } else if (addCent(total) === amount || addCent(amount) === total) { score += 25; reasons.push("AMOUNT_TOLERANCE"); } else reasons.push("AMOUNT_MISMATCH"); }
      if (evidence.date) { const distance = dateDistance(evidence.date, dateParts(transaction.postedAt)); if (distance === 0) { score += 25; reasons.push("EXACT_DATE"); } else if (distance <= 3) { score += 15; reasons.push("NEAR_DATE"); } else reasons.push("DATE_OUTSIDE_WINDOW"); }
      const merchant = normalized(evidence.merchant ?? evidence.description); const transactionText = normalized(`${transaction.merchantName ?? ""} ${transaction.description}`);
      if (similar(merchant, transactionText)) { score += 20; reasons.push("MERCHANT_MATCH"); }
      if (evidence.currency && evidence.currency === businessCurrency) { score += 5; reasons.push("CURRENCY_MATCH"); }
      const identifier = normalized(evidence.identifier); if (identifier && normalized(transaction.sourceReference).includes(identifier)) { score += 15; reasons.push("IDENTIFIER_MATCH"); }
      return { score: Math.min(score, 100), reasons };
    },
  };
}
