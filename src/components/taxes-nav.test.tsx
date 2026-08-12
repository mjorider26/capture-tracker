import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/demo/taxes" }));

import { TaxesNav } from "./taxes-nav";

describe("taxes navigation", () => {
  it("does not expose authenticated-only destinations in the fictional demo", () => {
    const html = renderToStaticMarkup(<TaxesNav basePath="/demo" />);

    ["Overview", "Estimates", "Payroll", "Owner money", "Owner compensation", "Year-end"].forEach((label) => expect(html).toContain(label));
    expect(html).not.toContain("/demo/taxes/mileage");
    expect(html).not.toContain("/demo/taxes/fixed-assets");
    expect(html).not.toContain("/demo/taxes/close");
  });
});
