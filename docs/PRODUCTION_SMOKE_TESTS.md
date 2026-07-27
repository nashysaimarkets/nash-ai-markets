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
- [ ] Pro monthly (£14.99), Elite monthly (£29.99), Pro annual (£149) and Elite
      annual (£299) each create the intended Stripe test-mode checkout.
- [ ] Commercial administration matches registered Supabase accounts, active
      Stripe subscriptions, cadence, MRR/ARR and Founding availability.
- [ ] `/welcome` does not claim entitlement before verification.
- [ ] Waiting-list registration accepts a valid email and returns a generic
      success response for a duplicate email.
- [ ] Invalid waiting-list input fails without exposing database details.

## Progressive Web App

- [ ] The manifest returns `display: standalone`, the correct scope, 192 px and
      512 px icons, and a maskable Android icon.
- [ ] Desktop Chromium offers installation only when its platform criteria are
      satisfied; dismissing the prompt does not block normal use.
- [ ] Android Chrome installs with the Standard Precision Ring icon and launches
      inside the declared application scope.
- [ ] iPhone Safari Add to Home Screen uses the Apple touch icon, standalone
      title and an appropriate static launch image.
- [ ] A waiting service-worker update is applied only after the member chooses
      Update; it never reloads a form automatically.
- [ ] Offline navigation shows the fail-closed offline screen and never replays
      account, market, billing or Morning Brief data as current.
- [ ] Reconnect, update, uninstall and reinstall have been exercised on one
      current physical iPhone and Android device.

## Registration and authentication

- [ ] New email requests a magic link without exposing provider errors.
- [ ] Magic link arrives and uses the production callback.
- [ ] Link establishes a session and opens `/terminal` (Today).
- [ ] Reusing an expired link fails safely.
- [ ] Authenticated navigation between Today (`/terminal`), Evidence (`/brief`), Review (`/review`) and Account (`/profile`) works.
- [ ] Sign-out ends the session and protected routes return to login.
- [ ] Display-name update validates input and persists without exposing errors.

## Free member

- [ ] Welcome shows Free membership and correct effective access.
- [ ] Today shows the Free market overview without Pro decision signals.
- [ ] Evidence and Review remain unavailable unless a valid Pro preview is active.
- [ ] Weekly Pro preview availability is correct.
- [ ] Locked Pro/Elite output is absent from the DOM.
- [ ] One Pro preview can be claimed.
- [ ] A second claim in the same UTC week is rejected safely.
- [ ] Preview reset wording contains no fake urgency.

## Pro member

- [ ] Active, unexpired Pro membership resolves to Pro.
- [ ] Today shows intelligence and the decision brief.
- [ ] Evidence reads the latest immutable snapshot without rebuilding history.
- [ ] Review reads preserved briefs and only the signed-in member’s journal records.
- [ ] What changed compares only with an earlier immutable session snapshot and stays unavailable when no prior snapshot exists.
- [ ] One-click decision capture stores a private decision without inventing a fill, position or result.
- [ ] Weekly process review counts only explicit journal fields and makes no performance claim.
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

## Today, Evidence and Review truthfulness

- [ ] Verified live data shows Live only with valid fresh timestamps.
- [ ] Permitted delayed data is prominent and within the delayed window.
- [ ] Cached/offline/fallback/preview states are never labelled Live.
- [ ] Unavailable state shows no confidence, bias, probability or trade output.
- [ ] Missing economic-calendar data shows unavailable, not a placeholder.
- [ ] Accuracy shows only verified stored outcomes or insufficient history.
- [ ] Morning Brief placeholder uses its fixed historical timestamp, explicit
      preview label and no confidence or directional guidance.
- [ ] With verified Pro/Elite data, the Morning Brief reports AI-assisted only
      after a valid structured OpenAI response.
- [ ] Missing OpenAI configuration, exhausted quota, rate limiting, model
      denial, timeout and invalid output retain the deterministic brief and
      expose no provider error details.
- [ ] Free, preview and unavailable states do not make a Morning Brief OpenAI
      request.
- [ ] No fabricated candles, prices, levels, entries, stops or targets appear.
- [ ] Evidence never re-runs the current engine and presents it as a historical record.
- [ ] Review withholds percentages until at least five qualifying closed journal records exist.
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
