import "server-only";

export type ExtractionField = {
  fieldType: "MERCHANT_NAME" | "DOCUMENT_DATE" | "TOTAL_AMOUNT" | "SUBTOTAL_AMOUNT" | "SALES_TAX_AMOUNT" | "TIP_AMOUNT" | "REFERENCE_NUMBER" | "CURRENCY" | "PAYMENT_METHOD" | "MASKED_ACCOUNT_REFERENCE" | "DOCUMENT_DESCRIPTION";
  originalValue: string;
  normalizedValue?: string;
  confidence: string;
  pageNumber?: number;
  sourceReference?: string;
};

export type ExtractionProvider = {
  id: string;
  version: string;
  extract(input: { bytes: Uint8Array; mimeType: string; displayName: string; sourceSha256: string; signal?: AbortSignal }): Promise<{ ok: true; pageCount: number; fields: ExtractionField[] } | { ok: false; failureCode: "FIXTURE_UNRECOGNIZED" | "FIXTURE_FAILURE" }>;
};

const receipt = [
  ["MERCHANT_NAME", "Fictional Field Supply", "Fictional Field Supply", "0.9800"],
  ["DOCUMENT_DATE", "2026-07-05", "2026-07-05", "0.9600"],
  ["SUBTOTAL_AMOUNT", "222.22", "222.22", "0.9400"],
  ["SALES_TAX_AMOUNT", "17.78", "17.78", "0.9400"],
  ["TOTAL_AMOUNT", "240.00", "240.00", "0.9900"],
  ["CURRENCY", "USD", "USD", "0.9900"],
] as const;

function fields(values: readonly (readonly [ExtractionField["fieldType"], string, string, string])[]): ExtractionField[] {
  return values.map(([fieldType, originalValue, normalizedValue, confidence], index) => ({ fieldType, originalValue, normalizedValue, confidence, pageNumber: 1, sourceReference: `fixture-field-${index + 1}` }));
}

export function createExtractionProvider(): ExtractionProvider {
  if (process.env.NODE_ENV === "production" || process.env.CAPTURE_TRACKER_REAL_DATA_APPROVED === "true") {
    throw new Error("No approved production document extraction provider is configured.");
  }
  return {
    id: "fictional-local-extraction",
    version: "1",
    async extract(input) {
      if (!input.bytes.byteLength || !["application/pdf", "image/jpeg", "image/png"].includes(input.mimeType)) return { ok: false, failureCode: "FIXTURE_UNRECOGNIZED" };
      const label = input.displayName.toLowerCase();
      if (label.includes("failed extraction")) return { ok: false, failureCode: "FIXTURE_FAILURE" };
      if (label.includes("office") || label.includes("receipt")) return { ok: true, pageCount: 1, fields: [...fields(receipt), { fieldType: "REFERENCE_NUMBER", originalValue: "FS-0007", normalizedValue: "FS-0007", confidence: "0.4100", pageNumber: 1, sourceReference: "fixture-low-confidence" }] };
      if (label.includes("statement")) return { ok: true, pageCount: 1, fields: fields([["DOCUMENT_DATE", "2026-07-31", "2026-07-31", "0.9700"], ["MASKED_ACCOUNT_REFERENCE", "•••• 1001", "•••• 1001", "0.9900"], ["DOCUMENT_DESCRIPTION", "Fictional July business statement", "Fictional July business statement", "0.9300"]]) };
      if (label.includes("tax")) return { ok: true, pageCount: 1, fields: fields([["DOCUMENT_DATE", "2026-07-15", "2026-07-15", "0.9000"], ["REFERENCE_NUMBER", "TAX-DEMO-2026-Q3", "TAX-DEMO-2026-Q3", "0.8200"], ["CURRENCY", "USD", "USD", "0.9900"]]) };
      if (label.includes("payroll")) return { ok: true, pageCount: 1, fields: fields([["DOCUMENT_DATE", "2026-07-16", "2026-07-16", "0.9000"], ["TOTAL_AMOUNT", "2000.00", "2000.00", "0.8800"], ["DOCUMENT_DESCRIPTION", "Fictional payroll summary", "Fictional payroll summary", "0.9400"]]) };
      return { ok: false, failureCode: "FIXTURE_UNRECOGNIZED" };
    },
  };
}
