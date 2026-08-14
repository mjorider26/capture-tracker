import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./sign-out-button", () => ({ SignOutButton: () => <button>Sign out</button> }));
vi.mock("./brand", () => ({ BrandIcon: () => <span>CT</span> }));

import { OnboardingShell } from "./onboarding-shell";

describe("customer onboarding shell", () => {
  it("hides normal application navigation and exposes saved setup progress", () => {
    const html = renderToStaticMarkup(<OnboardingShell businessName="Fictional Studio, Inc." phase="STARTING_BOOKS_IN_PROGRESS"><p>Starting books form</p></OnboardingShell>);
    expect(html).toContain("Setting up Fictional Studio, Inc.");
    expect(html).toContain("Starting books");
    expect(html).toContain("Your progress saves after every step");
    expect(html).not.toContain("Primary navigation");
  });
});
