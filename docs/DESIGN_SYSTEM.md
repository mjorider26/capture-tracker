# Capture Tracker design system

## Brand assets

The approved source is the supplied `capturetracker_logo.jpg`. Optimized faithful crops live in `public/brand/`:

- `capture-tracker-lockup.png` — full wordmark and baked-in tagline, for the root experience.
- `capture-tracker-icon.png` — the exact octagonal circuit-frame mark with its circular teal-bars window.
- `capture-tracker-wordmark.png` — the original wordmark crop.
- `favicon-16.png`, `favicon-32.png`, and `apple-touch-icon.png` — faithful icon derivatives.

Do not redraw, recolor, distort, add effects to, or replace these assets. The tagline is **SPENDING TRACKED. BUSINESS GROWN.** When the flattened lockup is used without separately rendered tagline text, its alt text must include that tagline.

## Tokens

| Token                                      | Value                                                     | Use                                                 |
| ------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------- |
| Brand navy                                 | `#082B4D`                                                 | Structural trust, headings, primary action          |
| Navy strong                                | `#061F38`                                                 | Primary-action hover                                |
| Teal gradient light                        | `#20C9A8`                                                 | Logo bars/decorative gradient only                  |
| Teal gradient dark                         | `#078B91`                                                 | Logo bars/decorative gradient only                  |
| Canonical UI teal                          | `#078C87`                                                 | Focus, accent, positive action; not tiny body text  |
| Teal soft                                  | `#E5F6F3`                                                 | Selected and supporting surfaces                    |
| Page / surface / secondary                 | `#F5F7F5` / `#FFFFFF` / `#F0F5F4`                         | Calm neutral hierarchy                              |
| Text / muted / subtle                      | `#10233F` / `#53667A` / `#718198`                         | Accessible reading hierarchy                        |
| Border / strong border                     | `#D9E2E6` / `#B6C6CE`                                     | Separation and form controls                        |
| Info / success / warning / danger / locked | `#245FAE` / `#08765F` / `#9A5C00` / `#B42318` / `#5B6472` | Semantic states, with matching soft status surfaces |

## Reusable patterns

Use `Card`, `PageHeader`, `StatusBadge`, `InlineAlert`, `EmptyState`, `BrandLockup`, and `BrandIcon` before making a one-off pattern. Use `ui-card`, `ui-input`, token utilities, and the system font stack; do not add remote fonts. Financial values use `.money-value` for tabular numerals.

Spacing uses compact 12px, standard 16px, section 24–32px, and mobile gutters 16px. Radius is 10px, 14px, and 18px. Shadows are restrained; borders and surfaces carry most hierarchy. Motion is 160ms and must honor reduced motion.

Status always uses text plus color. Forms keep visible labels, 44px controls, focus rings, help text, and exact Decimal strings. Mobile layouts preserve bottom-navigation clearance and wrap filters rather than squeezing them.

The local-only `/demo/design-system` route is the live UI reference for future Taxes, Documents, and Ask AI work.
