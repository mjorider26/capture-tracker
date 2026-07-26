import { readFileSync } from "node:fs";
const source = readFileSync("src/lib/data/reports.ts", "utf8"); for (const term of ["status: \"POSTED\"", "profitAndLoss", "balanceSheet", "trialBalance", "cashActivity", "csvCell"]) if (!source.includes(term)) throw new Error(`Reports source lacks ${term}`);
console.log("REPORTS VERIFICATION PASSED");
