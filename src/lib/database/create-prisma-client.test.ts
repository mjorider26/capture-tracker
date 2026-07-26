import { describe, expect, it } from "vitest";

import { normalizePrismaConnectionString } from "./create-prisma-client";

describe("Prisma connection construction", () => {
  it("uses IPv4 loopback for a local development connection", () => {
    expect(normalizePrismaConnectionString("postgres://user:pass@localhost:51214/template1?sslmode=disable")).toContain("@127.0.0.1:51214/template1?sslmode=disable");
  });

  it("preserves a non-local database host", () => {
    expect(normalizePrismaConnectionString("postgres://user:pass@db.example.test:5432/app")).toContain("@db.example.test:5432/app");
  });
});
