import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OwnerRoutineGuide } from "./owner-routine-guide";

describe("owner routine guide", () => {
  it("answers daily, weekly, monthly, year-end, profit, Owner Money, and CPA discovery on one screen", () => {
    const html = renderToStaticMarkup(<OwnerRoutineGuide basePath="/app" />);
    ["As things happen", "Once a week", "Once a month", "During the year", "At year-end", "Run My Books", "Where do I see profit?", "What is Owner Money?", "CPA package"].forEach((copy) => expect(html).toContain(copy));
  });
});
