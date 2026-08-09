import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const oldTagline = ["SPEND", "TRACKED. BUSINESS GROWN."].join(" ");
const officialTagline = "SPENDING TRACKED. BUSINESS GROWN.";

describe("Capture Tracker brand tagline", () => {
  it("uses the official tagline and excludes the outdated copy from tracked text", () => {
    const files = execFileSync("git", ["ls-files"], {
      cwd: resolve(process.cwd()),
      encoding: "utf8",
    })
      .split(/\r?\n/)
      // Repository-local Codex skills quote the retired tagline solely to prohibit it.
      // Brand enforcement applies to product and operational source, not agent instructions.
      .filter((file) => Boolean(file) && !file.startsWith(".agents/"));

    const trackedText = files
      .map((file) => {
        const source = readFileSync(resolve(process.cwd(), file));
        return source.includes(0) ? "" : source.toString("utf8");
      })
      .join("\n");

    expect(trackedText).not.toContain(oldTagline);
    expect(readFileSync(resolve("src/components/brand.tsx"), "utf8")).toContain(
      officialTagline,
    );
    expect(readFileSync(resolve("src/app/layout.tsx"), "utf8")).toContain(
      officialTagline,
    );
  });
});
