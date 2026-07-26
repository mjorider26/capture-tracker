import { describe, expect, it } from "vitest";

import { localDevOrigins } from "./local-dev-origins";

describe("local development origins", () => {
  it("keeps only individually configured private IPv4 LAN addresses", () => {
    expect(localDevOrigins("192.168.0.119, 10.0.0.5, example.com, *.local, 8.8.8.8"))
      .toEqual(["192.168.0.119", "10.0.0.5"]);
  });

  it("defaults to no additional development origins", () => {
    expect(localDevOrigins("")).toEqual([]);
  });
});
