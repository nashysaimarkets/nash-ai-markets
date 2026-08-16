# Project Bullseye — current verified handoff

## Credit-saving Sites workspace recovery

- Sites is installed, enabled and owner access to `nash-ai-markets-bullseye-staging` was confirmed on 16 August 2026.
- Before opening by slug, check for the warm official checkout at `/workspace/sites/nash-ai-markets-bullseye-staging`.
- When its `.openai/hosting.json` exists, use the official Sites `edit --path /workspace/sites/nash-ai-markets-bullseye-staging` workflow. This avoids creating another dependency/network handoff.
- Use the slug workflow only once when the warm checkout is genuinely absent. Never loop cancelled handoff requests; continue isolated GitHub/Vercel work without touching production and report the platform permission fault.

Last saved: **16 August 2026, 00:05 BST**

Latest private acceptance and isolation evidence: **16 August 2026, 15:06 BST**

## Paste this into ChatGPT or Cursor on another device

> WAKE PROJECT BULLSEYE — RESUME FROM THE SAVED PRIVATE-STAGING CHECKPOINT.
>
> Repository: `nashysaimarkets/nash-ai-markets`
> Branch: `release/bullseye-launch-candidate`
> Saved checkpoint branch: `checkpoint/bullseye-2026-08-16-0005-bst`
>
> First verify the branch and checkpoint before changing anything. Preserve the real Bullseye interface, authentication, membership gates, delayed-data disclosures, VerifiedMacroContext, ES/VIX fail-closed controls, marketing-preview isolation, Stripe safety and all current customer-data protections. Work only on private staging unless Chris gives an explicit public-production instruction. Make controlled changes, run proportionate tests and save credits by avoiding repeated discovery.

## Exact saved checkpoint

- Canonical repository: `nashysaimarkets/nash-ai-markets`
- Active branch before this handoff commit: `release/bullseye-launch-candidate`
- Verified application head before this handoff commit: `a509d3bc963189a14213db3bf0e9657f4b81fa03`
- Latest successful GitHub Actions gate: run `31913570855` — **SUCCESS**
- Latest Vercel preview deployment: `dpl_DVQpQ9jV8JxCN4fvJvCUvz9QBLKR` — **READY**
- Latest preview URL: `https://nash-ai-markets-xunaqhv5b-nash-ai-markets.vercel.app`
- Latest preview runtime review: no error, fatal or warning entries in the checked window
- Pull request: **#37**, open, draft, unmerged
- Base branch: `main`
- Public production: **UNTOUCHED / NO-GO**

The checkpoint branch named above is intended to point to the documentation save commit that contains this handoff.

## Current product state

### Core member product

- Real signed-in Bullseye Dashboard retained.
- Real Morning Brief retained.
- Real Trading Desk retained.
- Ideas, Reviews, Profile and Preferences use the current Bullseye design system.
- Journal and member writes retain same-origin and server-side protections.
- Authentication and membership entitlements remain enforced.
- Delayed, stale, unavailable, malformed, timeout and provider-failure states remain explicit and fail closed.
- The smiley Easter egg remains present as isolated presentation-only behaviour.

### Verified data and decision safety

- Official zero-cost macro providers from the completed migration phases remain isolated and additive.
- Phase 9 `VerifiedMacroContext` is integrated on Dashboard, Morning Brief and Trading Desk.
- Fabricated ES/VIX decision inputs remain blocked.
- The directional engine remains non-actionable when required evidence, freshness or entitlement is missing.
- Customer-facing ES/VIX populated-session acceptance remains blocked until written display/redistribution rights are obtained and tested.

### Private Vercel preview authentication evidence

- One passwordless request on the private feature preview delivered one sign-in link to the existing owner-member account.
- Opening the link in the requesting browser authenticated successfully and returned to protected `/dashboard`.
- Deliberate sign-out ended the session, and a direct `/dashboard` request returned to `/login`.
- Reusing the identical one-time link was rejected with `error=signin&reason=missing`; a subsequent `/dashboard` request remained unauthenticated.
- Supabase's project list confirms the private preview's baked `opmgzchnmcgnsfwpmysc` provider is named `nashaimarkets Project`, while `pxlqvaddvghjjhenqmdh` is `nashaimarkets-staging`. The test therefore exercised the production-linked auth service once and is not new acceptance evidence for isolated Sites staging.
- During that test, no second email was generated, no link token was recorded here, the session was signed out, the link was invalidated, and no code, deployment or Supabase configuration was changed. Routine auth session/audit metadata may have been recorded by the production-linked provider.
- The feature branch now fails closed before OTP submission whenever a Vercel deployment URL is compiled against anything except `nashaimarkets-staging`; canonical production domains retain their existing provider behaviour.
- **93 focused auth, trust, navigation, preview-isolation, PWA and resilience tests pass locally.** Full connected CI/build remains pending because the fresh fallback checkout has no installed application dependencies.

### Private marketing walkthrough

`/marketing-preview` uses the actual Bullseye presentation with deterministic example-only data for:

- Dashboard
- Morning Brief
- Trading Desk
- Ideas
- Reviews
- Profile
- Preferences

Safety boundaries remain:

- production-blocked;
- `noindex, nofollow`;
- prominent **EXAMPLE-ONLY MEMBER EXPERIENCE** disclosure;
- navigation kept inside the preview;
- sign-out and protected writes disabled;
- no live Stripe, Supabase write, provider mutation, order execution or customer-data mutation;
- example figures cannot enter production or the real decision engine.

### Commercial and growth preparation

- Standard catalogue remains Pro £14.99 monthly / £149 annual and Elite £29.99 monthly / £299 annual.
- Founding Pro remains a separate intended £12 monthly offer for the first 100 qualifying subscriptions once genuinely opened.
- Stripe application work is implemented; remaining Stripe work is operational test-mode lifecycle evidence unless runtime testing finds a defect.
- The waitlist page has launch-specific social metadata and a self-canonical `/waitlist` destination.
- Waitlist submission remains server-managed, same-origin checked and non-entitling.
- Dormant Resend transport and branded launch templates exist but sending remains fail closed until provider, sender and credential are deliberately configured.
- `docs/ADVERTISING_LAUNCH_PLAN.md` contains the compliant prelaunch advertising boundary.
- `docs/ORGANIC_PRELAUNCH_CAMPAIGN_PACK.md` contains the seven-post organic launch sequence, hooks, scripts and posting controls.
- `docs/BULLSEYE_PRODUCT_MOAT_ROADMAP.md` defines the product differentiation roadmap.

### Approved launch-film state

Approved creative master:

- `Bullseye_Cinematic_Launch_Film_v16_BrighterBarcodeTransitions.mp4`
- dark slow-techno soundtrack;
- no static sound;
- no woop sound;
- no full-screen shaking;
- large softened double-pulse bullseye opening;
- large double-pulse bullseye ending;
- smoother fades;
- bright, very thin moving barcode-style lines shifting side to side during transitions.

Do not replace this creative direction with robotic narration, harsh jitter, static or alarm-style effects.

## Automated evidence at save time

The latest complete Bullseye quality gate passes:

- repository secret scan;
- TypeScript;
- ESLint;
- **617 / 617** unit tests;
- **4 / 4** component-render tests;
- **8 / 8** production-safeguard simulations;
- operations-document validation;
- verified Sites artifact build;
- rendered production-artifact tests.

## Remaining public-launch blockers

1. Run connected CI/build for the new Vercel-preview auth guard, then verify on the resulting private deployment that `/login` fails closed before OTP submission. Use only an inert test address for that check and generate no email. Use isolated Sites staging for any future real authentication test.
2. Complete tablet-width, keyboard and VoiceOver/TalkBack evidence on private staging. Private-preview protected-route evidence and the owner-reported phone navigation pass are recorded, including the repaired auto-closing member menu.
3. Record natural passwordless-link time-expiry evidence only if separately required. Deliberate sign-out, return-path and same-link reuse rejection passed with one email on the private Vercel preview on 16 August 2026.
4. Send and compare the prepared market-data vendor enquiries; obtain written ES/CME and Cboe/VIX customer-display and derived-use rights.
5. Connect the chosen licensed feed only after first-cohort economics are understood, then run the symbol, candle, freshness, fail-closed and provider-budget acceptance matrix.
6. Confirm transactional-email sender/domain, suppression handling, idempotency, delivery monitoring and named ownership.
7. Configure monitoring thresholds, test alerts and incident ownership.
8. Record backup/restore evidence, rollback owner, RPO/RTO and escalation path.
9. Complete privacy, retention/deletion, processor/vendor and advertising/tracking approval.
10. Obtain qualified risk-disclaimer and financial-promotion review for intended jurisdictions.
11. Run the final private-staging soak and record the explicit public go/no-go decision.

## Advertising decision

- Organic teaser and truthful waitlist preparation may continue after final asset/copy review.
- Paid advertising remains **HOLD** until the campaign destination, platform verification, consent-aware measurement and qualified financial-promotion review are cleared.
- Paid subscription acquisition remains **HOLD** until the marketed product capability is actually deliverable.
- Never advertise live data, profits, prediction accuracy, trade signals or guaranteed outcomes unless a future approved evidence and legal process expressly permits the exact claim.

## Product direction

Bullseye should win as:

> **The most trustworthy S&P 500 session operating system — from orientation to decision to review.**

Highest-value differentiation after launch:

1. “What changed since my last verified visit?”
2. A transparent evidence map explaining why Bullseye changed.
3. Catalyst-specific Event Mode for CPI, payrolls, FOMC and similar releases.
4. Immutable session plan versus verified outcome replay.
5. Personal Risk OS and decision-change alerts.
6. Process analytics and guided replay that score discipline rather than guessed direction.
7. Ask Bullseye answers linked to exact verified sources and timestamps.

Avoid universal-charting bloat, black-box prediction claims, copy trading, automatic execution, noisy social feeds, profit leaderboards and fabricated probabilities.

## Safety boundaries

Do not, without an explicit later instruction:

- merge PR #37;
- deploy public production;
- change production DNS;
- activate or alter live Stripe billing;
- rotate secrets;
- alter Supabase production configuration or weaken RLS;
- bypass authentication or membership gates;
- weaken ES/VIX decision logic or data-safety controls;
- represent example, delayed, stale or unavailable data as live;
- purchase a provider before written rights and economics are confirmed;
- send marketing campaigns or vendor emails without the appropriate final owner/compliance action.

## Current decision

**PRIVATE STAGING AND PRELAUNCH PREPARATION CONTINUE — PUBLIC PRODUCTION AND PAID ACQUISITION REMAIN NO-GO.**
