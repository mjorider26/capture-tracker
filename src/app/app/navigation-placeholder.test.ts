import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const text = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("authenticated navigation completion", () => {
  it("does not retain authenticated destination placeholder copy", () => {
    const sources = [text("src/app/app/[destination]/page.tsx"), text("src/app/demo/[destination]/page.tsx")].join("\n");
    expect(sources).not.toMatch(/coming in a next phase|intentionally not implemented|placeholder/i);
  });

  it("has concrete routes for every primary application destination", () => {
    ["activity", "ask-ai", "documents", "money", "reports", "review", "settings", "taxes"].forEach((route) => expect(existsSync(resolve(root, "src/app/app", route))).toBe(true));
    ["activity", "settings"].forEach((route) => expect(existsSync(resolve(root, "src/app/demo", route))).toBe(true));
  });

  it("uses bounded loading and a safe retry boundary", () => {
    expect(text("src/app/app/loading.tsx")).toContain("Loading financial workspace");
    expect(text("src/app/app/error.tsx")).toContain("Try again");
  });
});
