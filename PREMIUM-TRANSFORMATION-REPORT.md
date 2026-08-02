# Premium Product Transformation — Report

**Date:** 31 July 2026
**Scope executed:** Phase 1 (discovery and safeguards), Phase 3 (Command Centre — partial),
Phase 9 (component decisions), Phase 10 (validation), and the four required documents.
**Scope not executed:** listed in full under "What was not done" — read that section before
planning the next pass.

---

## Executive summary

The single most valuable outcome of this pass was not a visual change. It was building a way
to **see the authenticated product at all**, and then finding a real layout bug that no
previous audit could have caught.

The existing audit harness can only reach public routes unless `AUDIT_USER_EMAIL` and
`AUDIT_USER_PASSWORD` are configured, and they are not. Every "zero findings, zero
horizontal overflow" result in the previous audit therefore covered 12 public pages and
**none of the member product** — not the Command Centre, not the Morning Brief, not the
Trading Desk. The most important surfaces in the product were unmeasured.

Rendering the real components against a fixed synthetic fixture and measuring them showed:

| Measure | Before | After |
|---|---|---|
| Command Centre horizontal overflow at 390px | **Yes — 407px in a 390px viewport** | None |
| Horizontal overflow at 320 / 360 / 375 / 430px | **Yes at all four** | None |
| Command strip cells shown | 14, of which 6 permanently empty | 9 readable + 1 disclosure line |
| Desktop page height | 11,107px | 10,942px |
| Dead space in desktop hero | ~110px void beside the greeting | Removed |
| Unit tests | 459 | 465 |

Everything below 400px wide was broken. Content was clipped off the right edge of the
screen on the most common phone sizes, on the product's primary daily surface.

---

## The overflow bug

**Symptom.** Every direct child of `.marketCommandCentre` rendered 395px wide inside a
366px container, pushing the document to 407px in a 390px viewport. Text was clipped
mid-word on the right edge: "OP[EN]", "1[h] 40m", "6,253[.67]".

**Cause.** `.marketCommandCentre` is `display:grid`. Grid items default to
`min-width:auto`, which means an item cannot shrink below its own min-content width. One
child with a wide min-content contribution sized the entire column track past the
container's fixed `width:min(1560px, calc(100% - 48px))`, and because the container width
was fixed, every sibling stretched to the oversized track and spilled off-screen.

Three things contributed the excessive min-content floor:

1. **Grid items could not shrink.** The structural cause above.
2. **Non-wrapping flex headers.** `.dashDecisionSnap > header` and the eight
   `.oracle* header` rules place a heading beside a status pill with
   `justify-content:space-between` and no `flex-wrap`. Below roughly 400px the pair cannot
   share a row, so the header demanded 349px inside a 305px box.
3. **Concept-hint popovers.** `.oracleConceptHint > div` was capped at `max-width:36ch`,
   but these hints open inside command-strip and internals cells as narrow as 88px. A long
   unbreakable term such as "advancing/declining" then set a min-content floor 53px wider
   than its own cell.

**Fix.** Three rules, each addressing one cause:

```css
/* app/market-command-centre.css */
.marketCommandCentre>*{min-width:0}
.dashDecisionSnap>header{...;flex-wrap:wrap}
.dashDecisionSnap>header>*{min-width:0}

/* app/components/oracle/oracle.css */
.oracle* header{...;flex-wrap:wrap}
.oracleConceptHint>div{max-width:min(36ch,100%);overflow-wrap:anywhere}
```

**Verification.** Measured `document.documentElement.scrollWidth` against `clientWidth` on
the fully rendered Command Centre at 320, 360, 375, 390, 430, 768, 1024, 1280 and 1440px,
for both the populated and feeds-unavailable fixtures — 18 combinations, all clean.
The fix was proven by CSS injection *before* being written to any stylesheet.

---

## Command Centre changes

### Hero dead space

`.dashHero` used `align-items:stretch`, so the short greeting card was stretched to match
the tall market card, leaving roughly 110px of empty space in the most valuable area of the
page. Changed to `align-items:start`. The command strip now moves up into view and the fold
reaches the "Today in 30 seconds" panel, which previously sat below it.

### Command strip coverage honesty

The strip rendered 14 equal-weight cells. Six of them — SPY, Gold, Bitcoin, Breadth,
Put/Call, Tick — were **hardcoded `available: false`** with no data source at all. They
could never populate. They occupied a full second row of the densest, highest-value module
on the page, each repeating a variant of "no verified feed".

The model now distinguishes three coverage states rather than a single boolean:

| Coverage | Meaning | Presentation |
|---|---|---|
| `verified` | A verified value exists | Full cell |
| `pending` | We read this feed but have no value right now | Full cell, em dash, "awaiting" detail |
| `unconfigured` | No verified source exists for this instrument | One shared disclosure line |

This keeps the disclosure completely truthful — nothing is hidden, and the customer is told
exactly which instruments are not on the feed — while returning the strip to a single row
of readings that actually exist. `pending` and `unconfigured` are genuinely different
things: only the first can change during a session.

No value is fabricated in any state; a test asserts every non-verified cell renders an em
dash rather than an estimate.

---

## Tooling added

Four scripts, all additive and none in the customer path:

| Script | npm | Purpose |
|---|---|---|
| `preview-member-surfaces.tsx` | `preview:member` | Server-renders member surfaces against a synthetic fixture with the real stylesheets inlined |
| `preview-screenshots.mjs` | `preview:shots` | Screenshots those surfaces and names every overflowing element |
| `diagnose-overflow.mjs` | — | Reports which descendants force a track wider than its container, with DOM path and text |
| `try-css-fix.mjs` | — | Injects a candidate CSS patch and re-measures, so a fix is proven before it is committed |

The preview harness mirrors `MemberShell`'s DOM exactly. An earlier version wrapped content
in its own padded frame, which understated the real width — the measurements in this report
were taken only after that was corrected.

**The fixture is invented data for layout review.** It is not market data, it is written
only to `audit-output/preview/`, and it is never served.

---

## Protected areas left unchanged

Verified untouched: Supabase authentication, sign-in and magic-link flows, session
handling, membership resolution, row-level security, Stripe checkout, webhooks, billing
portal and subscription state, environment variables, market-data provider logic, candle
calculations, the decision engine, expected-move and support/resistance calculations,
scheduled jobs, deployment and Vercel configuration, delayed-data disclosures, and legal
and risk disclosures.

All previously-shipped audit fixes were confirmed intact: secret-scanner self-tests,
`temporarily_unavailable` → 503, gated diagnostic probes, UUID validation on idea actions,
monthly-unvote scoping, normalised email matching, chart `AbortController` cleanup,
service-worker listener cleanup, timeout cleanup, the journal query limit, route error
boundaries, branded global errors, the 11px type floor, and motion tokens.

**No tracked file was deleted.** No `git rm` was run.

---

## Tests

Six new tests in `tests/command-centre-layout.test.ts`:

1. Grid children carry `min-width:0` — pins the overflow fix
2. Posture and oracle headers wrap
3. Concept hints are width-capped and break long terms
4. Coverage states are assigned correctly (`verified` / `pending` / `unconfigured`)
5. Unconfigured instruments are excluded from the grid but still disclosed
6. No non-verified cell fabricates a value

The CSS assertions strip comments first, so they cannot pass against a commented-out rule.

## Validation

| Check | Result |
|---|---|
| `npm run lint` | Clean |
| `npm run typecheck` | Clean |
| `npm run test:unit` | **465 / 465** (was 459) |
| `npm run test:render` | 4 / 4 |
| `npm run build` | Succeeds |
| `npm run security:scan` | Clean across 512 files |
| Command Centre overflow, 9 widths × 2 fixtures | 18 / 18 clean |

---

## What was not done

The brief specified ten phases. This pass completed Phase 1, part of Phase 3, Phase 9 and
Phase 10. The following were **not** started, and the reasons matter for planning.

### Blocked on credentials

**Member-route visual verification.** Without `AUDIT_USER_EMAIL` and
`AUDIT_USER_PASSWORD` the audit harness cannot reach any authenticated route. The preview
harness is a workaround for *layout*, not a substitute for auditing the real route with
real data, real membership tiers and real error states. **Setting these two variables is
the highest-value unblock available** and would let the existing `npm run audit:all`
cover the member product.

### Blocked on design review

**Radius and shadow consolidation (Phase 2).** 279 border-radius declarations across 17
distinct values, and roughly 150 distinct box-shadows. The values cluster cleanly
(2–5px, 6–9px, 10–12px, 14–18px, 20–28px), so a five-step scale is obvious on paper — but
snapping ~279 sites changes the appearance of every card in the product, and no automated
check can say whether the result looks better. This needs a human decision, not a codemod.

Compounding it: `mission-control.css`, `dashboard-elite.css`, `homepage.css` and
`globals.css` are **minified**, with many rules per line. Mechanical rewrites of those files
are materially riskier than the line count suggests.

### Not attempted

- **Phase 4–8** — customer-experience pass, market-platform review, cross-page consistency,
  performance work, and the page-by-page quality pass.
- **Page length.** The Command Centre is 10,942px on desktop and 18,698px on mobile —
  roughly 22 phone screens. This is the most significant remaining product problem and is
  a hierarchy decision, not a styling one: it means deciding which of the ~16 stacked
  sections belong on the daily landing surface. It should not be done blind.
- **Helper consolidation (Phase 23).** Investigated but deliberately not executed — see
  below.
- **Morning Brief and Closing Review**, personalisation, onboarding, membership
  presentation, and the media phases beyond the existing Phase A.

### Investigated and deliberately deferred: the `clamp` family

The brief called for consolidating duplicated helpers and flagged the clamp signatures
specifically. There are nine implementations, and they are **not** interchangeable:

| Semantics | Implementations | Behaviour |
|---|---|---|
| Clamp 0–100, **no rounding** | `market-intelligence-engine.ts` | Pairs with a separate `round()` |
| Clamp 0–100, **with rounding** | `bullseye-engine.ts`, `dashboard-data.ts`, `customer-terminal.ts`, `trading-decision-engine.ts`, `BullseyeMissionControl.tsx`, `market-directional-gauges.ts` | Equivalent for finite input |
| Clamp 0–100, rounding **+ finite guard** | `visual-terminal.ts` (`clampConfidence`) | `NaN` → `0` |
| Clamp **−4 to 4**, no rounding | `market-desk-signals.ts` (`clampScore`) | Different range entirely |

The six rounding variants are provably equivalent for finite values, and all propagate
`NaN`. `clampConfidence` deliberately does not. Unifying them without preserving that
distinction would silently change decision-engine output — and the decision engine is on
the protected list. The safe consolidation is three explicitly named utilities plus
equivalence tests covering `NaN`, `Infinity`, negatives and `.5` boundaries. That is a
focused piece of work and should be its own change, not a footnote to a visual pass.

---

## Recommended next actions, in order

1. **Set `AUDIT_USER_EMAIL` and `AUDIT_USER_PASSWORD`.** Everything about member-route
   quality is gated on this. It converts the existing audit harness from covering 12 public
   pages to covering the whole product.
2. **Re-run `npm run audit:all` authenticated** and treat the resulting findings as the
   real baseline. The current "zero findings" number describes public pages only.
3. **Decide the Command Centre section list.** 22 phone screens is the biggest remaining
   product problem, and it is a product decision.
4. **Consolidate `clamp` into three named utilities with equivalence tests.**
5. **Hold a design review on radius and shadow**, then apply a five-step scale in one pass
   with before/after screenshots.
6. **Act on `PRODUCT-ROUTE-MAP.md`** — gate the two `/dev/*` pages, merge `/review` into
   `/reviews` and `/results` into `/performance`, and promote `/methodology`.
7. **Decide the fate of `app/chatgpt-auth.ts`** — an unreferenced second authentication
   path, deliberately untouched here.

## Honest assessment

This pass fixed a real, customer-visible bug on the product's most important screen, made
the busiest module tell the truth more clearly, and built the tooling that made both
possible and repeatable. It did not deliver the visual transformation the brief describes.

The gap is mostly not effort — it is evidence. Redesigning surfaces that cannot be seen,
with real data, at real membership tiers, would be exactly the blind rewrite the brief
warned against. The two credentials in item 1 are worth more to this project right now than
another pass of speculative styling.
