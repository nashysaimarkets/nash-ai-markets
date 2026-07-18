# Project BULLSEYE status

## Verified ES candle-data audit — 18 July 2026

- Branch: `premium-experience-easter-hunt`
- Audited commit: `aeb1fa4751989e05257527ea67352bca52efef72`
- Existing provider adapter: Financial Modeling Prep (FMP)
- Current Terminal coverage: FMP quote requests for `ESUSD`, `^VIX`, and
  `DX-Y.NYB`, plus the FMP Treasury rates endpoint for US 2Y and US 10Y.
- Current chart coverage: no production OHLCV endpoint is connected.
- Existing chart intervals in the UI: `1m`, `5m`, `15m`, `1h`, `4h`, and `1D`.
- Existing safeguards: malformed and unordered OHLCV rejection; snapshot
  future-time rejection; five-minute delayed classification; thirty-minute
  stale rejection; provider errors fail closed to `UNAVAILABLE` and `NO TRADE`.

### Audit decision

Implementation stopped before changing the market-data connection.

FMP documents historical OHLCV endpoints for the requested intraday intervals
and end-of-day history, but the repository does not contain authoritative
evidence that its assumed `ESUSD` symbol is the licensed CME E-mini S&P 500
futures contract or approved continuous-contract mapping. The checkout also has
no Vercel project link and no local deployment credentials, so the presence and
plan entitlement of `FMP_API_KEY` cannot be verified without calling the
provider.

### Exact missing requirement

Before implementation, supply verifiable deployment metadata confirming:

1. `MARKET_DATA_PROVIDER=fmp`, `FMP_API_KEY`, and `FMP_API_BASE_URL` are present
   in the intended Vercel environment (names/presence only; never disclose
   values);
2. the existing FMP plan permits commercial display of ES futures historical
   OHLCV for the required intervals without new paid usage; and
3. the provider's authoritative symbol catalogue identifies the exact CME ES
   contract or continuous-contract symbol and its exchange/licensing semantics.

Until those three points are confirmed, the production chart must remain in its
truthful “No verified candle data” state. No provider calls, market-data code
changes, deployments, or merges were made during this audit.

## Final launch sprint review — 18 July 2026

- Repository branch: `premium-experience-easter-hunt`
- Repository HEAD: `aeb1fa4751989e05257527ea67352bca52efef72`
- Authenticated preview:
  `https://nash-ai-markets-git-premium-experience-e-fc371b-nash-ai-markets.vercel.app`
- Estimated production readiness: 88%

### Completed

- Premium authenticated Dashboard with membership access, Morning Brief,
  Bullseye confidence, trade permission, daily mission, event safety state,
  verified-history state, Founding status, responsive layouts, restrained
  transitions and reduced-motion support.
- Bullseye Terminal chart renderer with candlesticks, volume, all requested
  timeframe controls, deterministic test-only fixture and truthful production
  unavailable state.
- Verified quote mappings for ES, VIX, US 2Y, US 10Y and Dollar Index through
  the existing FMP adapter.
- Golden Egg Hunt remains feature-flagged, persistent, accessible and hidden
  unless explicitly enabled.
- Authentication, Supabase, Stripe, membership, DNS and billing were not
  changed during this sprint.

### Outstanding

1. Confirm the existing FMP plan entitlement and commercial-display licence for
   ES historical OHLCV.
2. Confirm the authoritative FMP/CME ES contract or continuous-contract symbol.
3. Confirm the required FMP variable names are present in the intended Vercel
   environment.
4. After those confirmations, connect and validate the historical endpoint,
   deploy a preview, and perform authenticated desktop, tablet and mobile review.

### Known issues

- Production Terminal candles remain safely unavailable because a licensed,
  authoritative ES historical mapping has not been verified.
- The checkout is not linked to its Vercel project, so deployment environment
  presence and a new preview cannot be verified from this workspace.

### Recommended next action

Obtain read-only confirmation of the existing FMP plan entitlement and its
authoritative CME ES symbol catalogue entry. This is the narrowest remaining
step and avoids adding providers or incurring new API cost.

## Public launch-candidate preparation — 18 July 2026

### Completed

- Corrected the desktop homepage hero collision and reduced excessive section
  spacing without changing the established design language.
- Added a public Market Intelligence Journal at `/blog` using evergreen,
  educational, non-live content.
- Added `/membership` as a canonical redirect to `/pricing`.
- Strengthened the existing About and Contact public surfaces using the current
  brand system.
- Replaced the social-preview SVG reference with a verified 1200 × 630 PNG.
- Corrected the maskable application icon to its declared 512 × 512 dimensions.
- Added Organization, WebSite and SoftwareApplication structured data.
- Added page-level canonical metadata to the main acquisition routes.
- Added Blog to sitemap and robots discovery while explicitly excluding Ideas,
  Preferences and all other protected product routes.
- Added `docs/LAUNCH_CANDIDATE_CHECKLIST.md` to separate automated completion
  from checks requiring a real authenticated member or business approval.

### Validation evidence

- Public homepage reviewed at 1920 pixels with no heading collision.
- Homepage document height reduced from 6,665 to 6,159 pixels at the reviewed
  desktop viewport.
- Public Journal reviewed at 390 pixels with no horizontal overflow.
- About reviewed at 1024 pixels with no document-level horizontal overflow.
- No authentication, Supabase, Stripe, membership, market-data or billing
  behavior changed.

### Remaining launch gates

- Authenticated Elite visual and functional review by the account owner.
- Business confirmation of whether Preferences remains embedded in Profile or
  becomes a separate route.
- FMP entitlement, commercial-display licence and authoritative ES symbol
  confirmation before production candles are connected.
- Explicit approval to merge and deploy the release candidate.
