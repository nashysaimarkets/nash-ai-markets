# Production Smoke-Test Checklist

Run against the exact deployed release. Use dedicated test accounts and redact
emails, event IDs and customer IDs from evidence.

## Public and transport

- [ ] HTTPS homepage loads with no mixed content.
- [ ] HTTP redirects to the selected HTTPS host.
- [ ] TLS certificate is valid for the hostname.
- [ ] Security headers are present.
- [ ] Marketing, pricing, terms and privacy pages load.
- [ ] Free CTA opens `/login`.
- [ ] Pro and Elite checkout links open the intended production products.
- [ ] `/welcome` does not claim entitlement before verification.
- [ ] Waiting-list registration accepts a valid email and returns a generic
      success response for a duplicate email.
- [ ] Invalid waiting-list input fails without exposing database details.

## Registration and authentication

- [ ] New email requests a magic link without exposing provider errors.
- [ ] Magic link arrives and uses the production callback.
- [ ] Link establishes a session and opens `/dashboard`.
- [ ] Reusing an expired link fails safely.
- [ ] Authenticated navigation between dashboard, brief, terminal and profile works.
- [ ] Sign-out ends the session and protected routes return to login.
- [ ] Display-name update validates input and persists without exposing errors.

## Free member

- [ ] Welcome shows Free membership and correct effective access.
- [ ] Weekly Pro preview availability is correct.
- [ ] Locked Pro/Elite output is absent from the DOM.
- [ ] One Pro preview can be claimed.
- [ ] A second claim in the same UTC week is rejected safely.
- [ ] Preview reset wording contains no fake urgency.

## Pro member

- [ ] Active, unexpired Pro membership resolves to Pro.
- [ ] Intelligence and Decision Engine appear.
- [ ] Elite planner output remains absent unless preview is active.
- [ ] One Elite preview can be claimed per UTC day.
- [ ] Expired or non-active Pro membership resolves to Free.
- [ ] Founding Member onboarding is available and a valid submission remains
      pending review without changing membership access.

## Elite member

- [ ] Active, unexpired Elite membership resolves to Elite.
- [ ] Intelligence, decision, planner and diagnostics are available.
- [ ] Diagnostics reveal no keys, authenticated URLs or raw errors.
- [ ] Founding Member onboarding is available without implying guaranteed
      designation or additional entitlement.

## Founding Member access controls

- [ ] Signed-out and Free users cannot submit onboarding.
- [ ] Expired Pro/Elite memberships cannot submit onboarding.
- [ ] Malformed or cross-origin submissions fail safely.
- [ ] Submission never updates `memberships`, Stripe state or preview claims.

## Dashboard and terminal truthfulness

- [ ] Verified live data shows Live only with valid fresh timestamps.
- [ ] Permitted delayed data is prominent and within the delayed window.
- [ ] Cached/offline/fallback/preview states are never labelled Live.
- [ ] Unavailable state shows no confidence, bias, probability or trade output.
- [ ] Missing economic-calendar data shows unavailable, not a placeholder.
- [ ] Accuracy shows only verified stored outcomes or insufficient history.
- [ ] Morning Brief placeholder uses its fixed historical timestamp, explicit
      preview label and no confidence or directional guidance.
- [ ] No fabricated candles, prices, levels, entries, stops or targets appear.
- [ ] Risk and no-trade warnings remain prominent.
- [ ] Provider status, attribution and last update are plausible.
- [ ] Refresh and recovery after a temporary provider failure work.

## Billing and webhook

- [ ] Controlled Pro checkout completes.
- [ ] Signed webhook delivery returns 2xx.
- [ ] Membership record matches email, price-derived plan, status and period end.
- [ ] Member signs in with checkout email and receives Pro.
- [ ] Upgrade to Elite updates access.
- [ ] Payment failure produces the intended non-entitled state.
- [ ] Cancellation/deletion updates access after the current Stripe state.
- [ ] Customer portal opens and belongs to the correct account.
- [ ] Profile subscription status matches effective access, stored status and
      period end without displaying Stripe identifiers.
- [ ] Replayed duplicate webhook does not create duplicate membership rows.

## Failure and recovery

- [ ] Supabase query failure shows temporary/unavailable state without details.
- [ ] Provider timeout results in safe unavailable/no-trade output.
- [ ] Invalid, stale and future-dated provider responses are rejected.
- [ ] Dashboard and terminal error boundaries offer recovery.
- [ ] High-impact warnings remain visible through loading/retry.

## Accessibility, mobile and performance

- [ ] Complete login and terminal journey with keyboard only.
- [ ] Focus is visible and modal/help focus returns correctly.
- [ ] VoiceOver or equivalent announces controls, state and errors.
- [ ] 200% zoom retains all critical content.
- [ ] Current iPhone and Android viewport tests have no horizontal overflow.
- [ ] Reduced-motion preference suppresses non-essential motion.
- [ ] Initial page and authenticated responses meet the agreed beta baseline.
- [ ] No repeated refresh causes provider request storms or visible instability.

## Operations

- [ ] Diagnostics show expected environment, version, timestamp, commit and test total.
- [ ] Hosting, application, Supabase, Stripe and provider monitors remain healthy.
- [ ] No unexpected 4xx/5xx spike appears.
- [ ] Rollback artifact and operator remain available through the observation window.
