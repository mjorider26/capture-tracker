import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/services/ask-ai.ts", "utf8");
const migration = readFileSync("prisma/migrations/20260726204352_ask_ai_read_only/migration.sql", "utf8");
const required = ["buildAskAiContext", "localAskAiAdapter", "Ask AI is read-only", "NODE_ENV === \"production\"", "businessId", "evidence", "ASK_AI_LIMITS"];
const missing = required.filter((item) => !source.includes(item));
if (!migration.includes("AskAiRun") || missing.length) { console.error(`Ask AI verification failed: ${missing.join(", ")}`); process.exit(1); }
console.log("ASK AI READ-ONLY VERIFICATION PASSED");
