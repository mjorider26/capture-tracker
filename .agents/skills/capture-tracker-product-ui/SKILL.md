---
name: capture-tracker-product-ui
description: Product design and interaction standards for the authenticated Capture Tracker financial application, including mobile-first UX, financial information presentation, Owner Money, Today/Weekly Review, documents, CPA review, accessibility, responsive behavior, and restrained motion.
---

# Capture Tracker Product UI

Use this skill for the authenticated Capture Tracker product, not the public marketing website.

## Product principles

- Deliver a premium, calm, precise financial SaaS experience: mobile-first, never a generic admin dashboard.
- Put business meaning before accounting jargon; use progressive disclosure for technical accounting detail.
- Prefer deterministic status language over vague scores, including states such as “Books current through [date]”.
- Surface exceptions and owner decisions rather than piles of metrics; resolved work should leave attention surfaces.
- Keep money presentation consistent and scannable, and never rely on color alone for negative or exceptional states.
- Today and Weekly Review should show genuine decisions and blockers, not normal open items.

## Financial and role clarity

- Owner Money must preserve salary, distributions, reimbursements, contributions, shareholder loans, basis, and benefits as distinct concepts; never collapse them into generic “Owner Draw”.
- Visually distinguish document lifecycle states, including pending, quarantined, and active.
- CPA_READ_ONLY emphasizes professional review rather than owner actions.
- Public invoices should feel like professional business documents and must not expose authenticated navigation or internal accounting terminology.

## Interaction, branding, and responsiveness

- Use canonical Capture Tracker branding and the official tagline: `SPENDING TRACKED. BUSINESS GROWN.` Never reintroduce `SPEND TRACKED. BUSINESS GROWN.`
- Use restrained, purposeful motion; preserve `prefers-reduced-motion` and the accepted installed-iPhone pull-to-refresh behavior unless correcting a demonstrated defect.
- Review mobile behavior at 320, 375, 390/393, 430, 768, and desktop widths.

## UI completion checks

Before completing product UI work, confirm existing patterns were inspected and established primitives reused; check mobile widths, loading/empty/error/success states, realistic long values, accessibility, reduced motion, overflow, and that financial actions remain understandable.

For application architecture, financial logic, or testing, defer to `$capture-tracker-engineering`; for trust boundaries and sensitive data, defer to `$capture-tracker-security`; for release concerns, defer to `$capture-tracker-release`.
