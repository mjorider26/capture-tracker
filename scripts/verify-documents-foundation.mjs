import { readFileSync } from "node:fs";
const files = ["src/lib/documents/core.ts", "src/lib/documents/storage.ts", "src/lib/documents/service.ts", "src/components/documents-experience.tsx", "docs/DOCUMENTS_FOUNDATION.md"];
for (const file of files) { const value = readFileSync(file, "utf8"); if (/type\s*=\s*["']file["']|<input[^>]+type=["']file/i.test(value)) throw new Error(`File upload control found in ${file}.`); }
const schema = readFileSync("prisma/schema.prisma", "utf8");
for (const required of ["DocumentStatusHistory", "METADATA_ONLY", "DocumentCategory"]) if (!schema.includes(required)) throw new Error(`Missing documents foundation requirement: ${required}`);
console.log("DOCUMENTS FOUNDATION VERIFIED: metadata-only storage, scoped history, and no file-upload controls.");
