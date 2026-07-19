# Project BULLSEYE — Site-wide premium pass

Branch: `bullseye-sitewide-premium-pass`

## User-facing route inventory

### Public acquisition and trust

- `/` — homepage and membership conversion
- `/pricing` — Free, Pro and Elite pricing
- `/membership` — canonical membership redirect
- `/about` — company and methodology
- `/contact` — support
- `/help` — product and account guidance
- `/waitlist` — launch updates
- `/privacy`, `/terms`, `/risk-disclaimer` — legal and risk information
- `/welcome`, `/cancelled` — checkout return states
- `/login` — passwordless access
- `/membership-required` — gated-access recovery
- unmatched routes — branded 404

### Protected member experience

- `/dashboard` — daily member workspace
- `/brief` — market brief
- `/terminal` — Bullseye Terminal
- `/ideas`, `/ideas/[id]` — Ideas Hub
- `/profile` — profile and billing
- `/onboarding` — preferences
- `/founding-member` — Founding Member onboarding
- `/terminal/diagnostics` — protected launch diagnostics
- `/admin/commercial`, `/admin/founding-100` — restricted administration

### Authentication and service states

- `/auth/callback`, `/auth/confirm`, `/auth/implicit`, `/auth/signout`
- route-level loading and error states for Dashboard, Terminal, Brief, Ideas,
  Profile, Founding Member, Waitlist and Founding 100 administration
- `/offline.html` — safe offline state

## Missing standalone routes

- No standalone `/faq`; pricing contains the current FAQ.
- No public `/performance` or `/results`; this is appropriate until sufficient
  independently verified history exists.
- No public `/blog` or article route exists on current `main`.

These routes were not invented during this visual pass. A standalone FAQ may be
considered later. Performance/results must remain blocked until verified
history exists. A journal requires an explicit content and publishing decision.

## Visual implementation

- Added a reusable premium public-document shell with consistent logo,
  navigation, footer, focus states and responsive behaviour.
- Rebuilt About, Contact, Help, Privacy, Terms and Risk Disclaimer presentation
  on the shared shell without changing their service logic.
- Added shared site-wide visual tokens and premium treatments for outcome,
  gated-access, 404, member navigation and document states.
- Refined the authenticated member shell, Dashboard, Market Brief, Profile,
  Ideas Hub, onboarding and Founding Member surfaces with clearer hierarchy,
  larger readable typography, calmer service states and deliberate mobile
  reflow. Product logic and truthful unavailable-data handling are unchanged.
- Upgraded shared loading and error presentation, the membership-required
  recovery screen and branded 404 while preserving their existing destinations
  and recovery behaviour.
- Added explicit reduced-motion handling, visible keyboard focus, mobile tap
  targets and overflow safeguards.
- Preserved the Terminal's verified standby chart after the controlled FMP
  entitlement audit. All timeframe controls remain visible but are disabled
  and clearly labelled whenever verified, commercially licensed OHLCV is not
  available. Validated test-only candle data retains interactive controls.
- No FMP end-of-day or intraday candles were connected. The current FMP account
  returned HTTP 402 for 1-minute, 5-minute and 1-hour ESUSD history, and
  commercial display rights remain unverified.

## Validation

- TypeScript: passed
- ESLint: passed
- Unit tests: 240 passed
- Production build: passed
- Rendered HTML check: passed
- Production simulations: 8 passed
- Deployment artifact validation: passed
- Secret-pattern scan: passed
- Responsive browser checks: 30 public-route/viewport combinations, no
  document-level horizontal overflow

The final member-surface refinements were completed after browser access became
unavailable. Protected authenticated visual acceptance still requires a preview
with a real member session, plus desktop, tablet and mobile checks of Dashboard,
Brief, Terminal, Ideas, Profile, onboarding and Founding Member pages. The
membership-required, 404, loading and error states should be included in that
final browser pass.

Production candles remain blocked pending a properly entitled futures-data
source, authoritative contract/roll semantics, genuine-volume provenance and
written commercial display rights. The truthful standby state is the approved
release behaviour until those requirements are met.
