# Project BULLSEYE launch-candidate checklist

## Completed without authenticated access

- [x] Homepage desktop hero clipping corrected.
- [x] Homepage desktop section spacing tightened without changing the design.
- [x] Public Blog route added with evergreen, non-live educational content.
- [x] `/membership` resolves to the canonical Pricing experience.
- [x] About and Contact hierarchy strengthened using the existing brand system.
- [x] Per-page canonical metadata added to Homepage, About, Blog, Contact and Pricing.
- [x] Open Graph and Twitter metadata use a 1200 × 630 PNG.
- [x] Organization, WebSite and SoftwareApplication structured data added.
- [x] Sitemap includes Blog and excludes authenticated routes.
- [x] Robots policy includes sitemap/host and blocks protected product routes.
- [x] Favicon, Apple touch icon and manifest icon dimensions verified.
- [x] Maskable icon corrected to its declared 512 × 512 size.
- [x] Public launch assets remain free of live prices, testimonials and performance claims.

## Requires a real authenticated member

- [ ] Sign into the stable preview alias with the intended Elite account.
- [ ] Confirm the session persists across Dashboard, Terminal, Brief, Ideas and Profile.
- [ ] Verify Elite entitlement, Elite badge and all Elite-only panels.
- [ ] Verify Founding 100 badge, position and price-lock wording against the real account.
- [ ] Review Dashboard at desktop, tablet and mobile widths.
- [ ] Review Bullseye Terminal at desktop, tablet and mobile widths.
- [ ] Confirm Terminal safe offline state, provider timestamp and NO TRADE warnings.
- [ ] Confirm any verified delayed/live quote values have correct provenance and freshness.
- [ ] Verify chart interaction only after licensed ES OHLCV is connected.
- [ ] Verify Ideas submission, filters, voting and empty/error states.
- [ ] Verify Morning Brief entitlement and deterministic fallback behavior.
- [ ] Verify Profile updates and subscription-portal handoff.
- [ ] Verify onboarding completion and post-onboarding redirect.
- [ ] Decide whether a separate Preferences route is required; current preferences live within Profile/onboarding.
- [ ] Enable the Easter Hunt flag in preview only, then verify discovery, persistence, reset, keyboard access and reduced motion.
- [ ] Sign out and confirm protected routes return to login.

## Requires an external-console or business decision

- [ ] Confirm FMP entitlement, commercial-display licence and authoritative CME ES symbol mapping.
- [ ] Confirm production and preview FMP variable presence without exposing values.
- [ ] Decide whether Preferences should remain embedded or become a separate route.
- [ ] Approve the final public copy, legal text and subscription presentation.
- [ ] Approve merge and production deployment.

## Final release gate

- [ ] Preview deployment identifies the exact approved commit.
- [ ] Authenticated visual review has no blocking issue.
- [ ] TypeScript, ESLint, security scan, dependency audit, tests and production build pass.
- [ ] Production environment validation passes.
- [ ] Rollback commit and deployment procedure are recorded.
- [ ] Supabase migration state, Stripe webhook health and provider health are checked by an authorised operator.
- [ ] Production smoke test covers login, entitlement, Dashboard, Terminal, billing portal and logout.
