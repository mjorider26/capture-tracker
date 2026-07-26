# UI modernization

## Phase 13C, Pass 1

Capture Tracker now uses a calm financial-command-center foundation: navy framing for trustworthy context, teal only for purposeful emphasis, warm-neutral workspace surfaces, and clear hierarchy before decoration. The application remains a bookkeeping product first; visual components contain no business or financial logic.

## Token system

`src/app/globals.css` centralizes the shared visual language:

- page, primary, secondary, and tertiary surfaces;
- Capture Tracker navy and teal;
- accessible primary, muted, and subtle text; success, warning, danger, and focus colors;
- tabular financial numerals through `.money-value`;
- compact-to-generous radii, restrained shadows, 180ms easing, and reduced-motion overrides.

`src/components/ui.tsx` provides shared panel, card, page-header, status, button-link, progress, empty, error, and skeleton primitives. New product surfaces should use these tokens and primitives rather than introduce arbitrary colors or controls.

## Shell and navigation

Desktop uses a compact 240px navy sidebar with the existing icon-only mark, a compact business identity, grouped workspace navigation, clear selected state, and discreet local-demo language. The full marketing lockup remains limited to the landing page.

The responsive command bar supplies page context, business context, and the demo boundary. At compact widths, the sidebar is replaced by an accessible mobile drawer: a labeled open/close control, escape-key dismissal, selected state, and touch-sized destination links. The mobile bottom control preserves page context without attempting to duplicate every navigation item.

## Today dashboard

Today is structured as an executive view:

1. a unified approved-cash, projected-tax, reserve, and reserve-position summary;
2. a proportional cash-composition bar derived from approved business cash and dedicated reserve accounts;
3. a prioritized, business-scoped attention queue linking only to existing protected workflows;
4. a compact Weekly Review progress and next-action block that keeps unresolved work explicit;
5. a bounded ledger-backed activity timeline and safe quick links.

No financial value is hardcoded. Existing server-derived accounting and tax calculations are unchanged. Attention counts reuse the bounded, sequential Weekly Review count reader; the presentation only prioritizes and labels the returned counts.

## Accessibility and responsive rules

- Statuses use words as well as color; money values use tabular numerals.
- Semantic headings, named navigation, visible focus rings, progress-bar values, and accessible chart labels are required.
- Motion is limited to short interface feedback and disabled for reduced-motion preferences.
- The shell is verified at 1440px, 1024px, 768px, and 390px without horizontal overflow.

## Remaining passes

Later UI passes may apply this visual language to Money, Taxes, Documents, Review, Reports, Ask AI, Activity, and Settings in detail. They should not replace this shared shell, alter accounting workflows, or add unsupported automatic actions.
