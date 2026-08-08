import { describe, expect, it } from "vitest";
import { classificationMatchesDirection, ownerTransferSchema } from "./owner-transfer-core";
describe("owner transfer classification", () => {
  it("requires an explicit evidence record and direction", () => expect(ownerTransferSchema.safeParse({ externalTransactionId: "external-1", direction: "COMPANY_TO_OWNER", classification: "SHAREHOLDER_DISTRIBUTION" }).success).toBe(true));
  it("does not permit a directionally incompatible treatment", () => {
    expect(classificationMatchesDirection("COMPANY_TO_OWNER", "OWNER_CONTRIBUTION")).toBe(false);
    expect(classificationMatchesDirection("OWNER_TO_COMPANY", "PAYROLL_NET_SALARY")).toBe(false);
    expect(classificationMatchesDirection("OWNER_TO_COMPANY", "UNRESOLVED")).toBe(true);
  });
});
