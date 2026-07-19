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
- Added explicit reduced-motion handling, visible keyboard focus, mobile tap
  targets and overflow safeguards.

## Validation

- TypeScript: passed
- ESLint: passed
- Unit tests: 239 passed
- Production build: passed
- Rendered HTML check: passed
- Secret-pattern scan: passed
- Responsive browser checks: 30 public-route/viewport combinations, no
  document-level horizontal overflow

Protected authenticated visual acceptance still requires a preview with the
production-equivalent authentication configuration and a real member session.
