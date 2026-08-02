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

Desktop uses a compact 240px navy sidebar with the existing icon-only mark, a compact business identity, grouped workspace navigation, clear selected state, and discreet local-demo language. The full marketing lockup remains limited to the landing page. The expanded sidebar is now reserved for widths at or above 1180px; below that point the accessible compact navigation replaces it, so a 1024px workspace never has to compress desktop content around the rail.

The responsive command bar supplies page context, business context, and the demo boundary. At compact widths, it becomes a compact safe-area-aware CaptureTracker header with a subordinate current-section label and a single subdued demo/local indicator. The full desktop command bar retains workspace context without repeating the page title at every shell level.

## Phase 13C, Pass 1B

Mobile navigation uses a persistent five-tab bar: Today, Money, Review, Reports, and More. More opens an accessible, escape- and outside-click-dismissible sheet for Taxes, Documents, Ask AI, Activity, and Settings; it uses the same central destination list as the sidebar, so no supported module is hidden or duplicated. The selected route uses a teal treatment plus `aria-current` and a textual label. The fixed bar and header include iPhone safe-area spacing, while the application content reserves matching bottom space.

The application shell uses the existing icon-only Capture Tracker asset, not the marketing lockup. The former small-avatar impression came from nesting that padded source in a second white padded badge. The desktop and mobile shell now use a larger proportional mark on navy framing, with CaptureTracker kept visually distinct from the selected fictional business.

Teal is reserved for active navigation and purposeful product emphasis. The existing semantic success, warning, danger, information, locked, and neutral tokens remain responsible for financial and operational state.

## Today dashboard

Today is structured as an executive view:

1. a unified approved-cash, projected-tax, reserve, and reserve-position summary;
2. a proportional cash-composition bar derived from approved business cash and dedicated reserve accounts;
3. a prioritized, business-scoped attention queue linking only to existing protected workflows;
4. a compact Weekly Review progress and next-action block that keeps unresolved work explicit;
5. a bounded ledger-backed activity timeline and safe quick links.

No financial value is hardcoded. Existing server-derived accounting and tax calculations are unchanged. Attention counts reuse the bounded, sequential Weekly Review count reader; the presentation only prioritizes and labels the returned counts.

## Phase 13C, Pass 2

Money is now a focused review workspace. Its accessible workspace switcher keeps Transactions, Reconciliation, and Journal Activity distinct without changing their routes. A navy summary gives priority to the awaiting-review count, with supporting reviewed-business, excluded-personal, mixed, and account context. The transaction toolbar preserves the existing server-side query parameters and reset behavior; compact layouts keep search visible while secondary filters use a native accessible disclosure. Desktop uses a financial table with evidence, review, account, and signed tabular amount columns, while compact layouts use complete transaction records rather than a squeezed table.

Documents is now a secure evidence workspace. Lifecycle summaries and a short attention queue are derived from document validation, scan, extraction, match, and active-link state. The pipeline table and compact records make unavailable, pending, stale, failed, quarantined, and linked conditions explicit. The detail page progressively presents filename, validation, protected-access availability, scan state, retention, actions, and immutable status history. It intentionally does not expose document hashes, storage keys, grants, local paths, or other internal-only identifiers. Existing private access gates, extraction review, match approval, and document-link actions remain unchanged.

## Accessibility and responsive rules

- Statuses use words as well as color; money values use tabular numerals.
- Semantic headings, named navigation, visible focus rings, progress-bar values, and accessible chart labels are required.
- Motion is limited to short interface feedback and disabled for reduced-motion preferences.
- The shell is verified at 1440px, 1180px, 1024px, 768px, and 390px without horizontal overflow. At 1024px, Today, Money, and Documents use the compact shell rather than a constrained desktop sidebar.

## Remaining passes

Pass 3 may apply this visual language to Taxes, Weekly Review, Reports, Ask AI, Activity, and Settings in detail, and may make further non-functional refinements after visual review. It must not replace the shared shell, alter accounting workflows, or add unsupported automatic actions.

## UI v2 — Phase 1: Today briefing

Phase 1 refines the existing foundation only where the authenticated shell and Today experience need it. The canonical logo remains `public/brand/capture-tracker-icon.png` in the application shell and `public/brand/capture-tracker-lockup.png` for the marketing surface; no new logo treatment was introduced.

### Audit result

Today already had accurate, server-derived data and a sound server-component boundary. Its main visual weaknesses were that the upper summary gave every supporting metric the same visual treatment, attention rows and quick links competed as similarly bordered cards, and the generic app-loading geometry did not resemble the final briefing. The redesign keeps every data source, destination, label of record, and protected workflow, while making the attention queue and available-cash total easier to scan first.

### Tokens and primitives

`src/app/globals.css` remains the token source. Phase 1 aligns the approved navy, teal, neutral, and semantic values with this document and adds backward-compatible surface, elevation, disabled, focus-ring, skeleton, and briefing tokens. `ui-briefing`, `ui-metric-tile`, `ui-section-mark`, `ui-action-surface`, and `ui-skeleton` are presentation classes built on that layer. They are provisional shared patterns for later dashboard work, not a second theme system.

`src/components/ui.tsx` adds `SectionHeading` and updates `Skeleton` to use the shared skeleton treatment. Existing primitive contracts remain unchanged. New work should use `SectionHeading` for a label/title/action grouping, `ui-action-surface` for a compact protected-workflow link, and the semantic status primitives for all operational state.

### Today hierarchy and states

Today now reads in this order: available cash and tax position; the open decision queue; cash composition; recent ledger context and Weekly Review; then protected workflows. The available-cash briefing uses one restrained navy surface, a single subtle logo-inspired octagonal detail, and teal only as an accent. Attention items become the clear next-action layer without changing their count, destination, or priority. The empty-account, no-attention, no-review, warning, success, locked, loading, focus, hover, pressed, and disabled presentations are all explicit. The app-level error state remains a client error boundary and now uses textual, destructive styling without implying any financial record changed.

### Responsive and motion rules

Today becomes a balanced two-column briefing at 980px, preserves a focused single-column order below that width, and uses the existing safe-area-aware mobile navigation. The desktop selected navigation state now stays in the navy rail instead of switching to an unrelated white card; compact navigation gets the same selected elevation. Motion remains CSS-only, limited to color, shadow, opacity, and small transforms, and all nonessential motion is removed by the existing reduced-motion media query.

### Validation limitation

The local rendering attempt on `/demo/today` was blocked before and after implementation by a missing local database table: `public.StatementActivity`. This is a migration/environment mismatch in the configured local database, not a presentation change. No migration, schema, fixture, authentication, or data-flow change was made to bypass it. Therefore matched responsive screenshots and browser performance traces could not be truthfully produced from this workspace until that local database is brought to its existing migration level.
