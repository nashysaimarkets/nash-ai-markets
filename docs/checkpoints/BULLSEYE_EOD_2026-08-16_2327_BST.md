# Project Bullseye — end-of-day verified checkpoint

Saved: **Sunday 16 August 2026, 23:27 BST**

## Resume command

> WAKE PROJECT BULLSEYE — RESUME FROM THE END-OF-DAY VERIFIED CHECKPOINT.
>
> Repository: `nashysaimarkets/nash-ai-markets`
> Active launch-candidate branch: `release/bullseye-launch-candidate`
> Verified application HEAD: `9224fd0e3f4510ee695cd0251eeaca728c01f632`
> End-of-day checkpoint branch: `checkpoint/bullseye-2026-08-16-2327-bst`
>
> First verify that `release/bullseye-launch-candidate` still points to `9224fd0e3f4510ee695cd0251eeaca728c01f632`, or is a clean fast-forward descendant. Do not merge, reset or overwrite if histories diverge. Read this checkpoint and `docs/PROJECT_BULLSEYE_HANDOFF.md`; do not repeat completed discovery. Preserve production isolation, authentication and membership gates, Stripe safety, Supabase configuration, secrets, DNS, delayed-data disclosures, `VerifiedMacroContext`, ES/VIX fail-closed controls, noindex private previews and all customer-data protections.

## Exact saved state

- Canonical repository: `nashysaimarkets/nash-ai-markets`
- Active isolated branch: `release/bullseye-launch-candidate`
- Verified application HEAD: `9224fd0e3f4510ee695cd0251eeaca728c01f632`
- End-of-day checkpoint branch: `checkpoint/bullseye-2026-08-16-2327-bst`
- Checkpoint application parent: `9224fd0e3f4510ee695cd0251eeaca728c01f632`
- Pull request: **#37**, open, draft and unmerged into `main`
- Production branch `main`: `0d0cde533050503e45237237037383584c95ae11`
- Public production: **UNTOUCHED / NO-GO**

The checkpoint branch was created directly from the verified launch-candidate HEAD. This save adds documentation only on the checkpoint branch; it does not change the verified application tree on `release/bullseye-launch-candidate`.

## Verification evidence

Latest complete Bullseye quality gate:

- GitHub Actions run: `31973038270`
- Result: **SUCCESS**
- Repository secret scan: pass
- TypeScript: pass
- ESLint: pass
- Unit tests: pass
- Component render tests: pass
- Production-safeguard simulation: pass
- Operations-document validation: pass
- Verified production build: pass
- Rendered production-artifact tests: pass

Latest isolated Vercel Preview:

- Deployment: `dpl_8Zp5Jg2uL7Cjn9pm7CecRgDD25dQ`
- State: **READY**
- URL: `https://nash-ai-markets-awrort0j1-nash-ai-markets.vercel.app`
- Target: preview only, not production
- Runtime-error review: no recent runtime errors found
- Preview responses carry `x-robots-tag: noindex`

Direct route checks on the saved candidate:

- `/`: loads successfully
- `/waitlist`: loads successfully with the Bullseye V16 film, truthful example-only labelling and noindex preview protection
- `/login`: loads secure passwordless member access
- `/dashboard`: unauthenticated access is redirected to `/login`
- `/brief`: unauthenticated access is redirected to `/login`
- `/terminal`: unauthenticated access is redirected to `/login`
- `/journal`: unauthenticated access is redirected to `/login`

## Defect found and fixed during final verification

The first full gate exposed two React lint failures caused by synchronous device-local state hydration inside effects:

- `app/components/oracle/ReturnVisitBriefing.tsx`
- `app/launch-preview/_components/SessionChallenge.tsx`

The fix was isolated through PR #39 and merged only into `release/bullseye-launch-candidate`. The two hydrations are now deferred through cancellable microtasks. Existing loading states, local-only privacy, reset behaviour and fail-closed market-data behaviour remain intact. No production, auth, Stripe, Supabase, DNS, secret or decision-engine changes were made.

## Product state preserved

- Genuine Bullseye Dashboard, Morning Brief and Trading Desk remain intact.
- Ideas, Reviews, Profile, Preferences and Journal retain the Bullseye member experience.
- Mobile-navigation close behaviour is fixed.
- Authentication and membership gates remain enforced.
- Same-origin and server-side write protections remain in place.
- Delayed, stale, unavailable, malformed and provider-failure states remain explicit.
- `VerifiedMacroContext` remains integrated without replacing ES/VIX evidence.
- ES/VIX-dependent directional guidance remains fail closed when required evidence or rights are absent.
- Private marketing and launch previews remain isolated, noindex and example-only.
- The return-visit briefing, evidence map, catalyst mode, local discipline challenge, launch-trust improvements and privacy controls are retained.

## Approved V16 launch film

Approved master retained on Chris's laptop:

- `Bullseye_Cinematic_Launch_Film_v16_BrighterBarcodeTransitions.mp4`

Permanent web assets retained in the repository:

- `public/launch/video/bullseye-v16-reveal-25s-web.mp4`
- `public/launch/video/bullseye-v16-reveal-poster.webp`

The web film remains first party, manual-play, transcript-supported, clearly labelled example-only/not-live data and free from third-party player tracking. Do not replace its approved dark slow-techno, smoother fades, double-pulse Bullseye opening/ending or thin moving barcode-transition direction without Chris's approval.

## Commercial-data position

- Intrinio provided preliminary general Startup/Enterprise display information but has not yet confirmed the complete CME ES plus Cboe VIX package, exact real-time/delayed rights, historical/intraday coverage, derived-use rights, promotional-display rights, exchange/per-subscriber fees or total launch price.
- Databento returned only an automated availability acknowledgement.
- The attempted dxFeed sales mailbox bounced; use the official dxFeed business quote form for any approved follow-up rather than guessing another address.
- Do not purchase, connect or activate a provider until written rights and first-cohort economics are compared.
- Customer-facing ES/VIX values, candles, VWAP/EMA and dependent actionable guidance must remain unavailable or truthfully delayed until the selected licence is signed and validated in isolated staging.

## Remaining hard launch gates

1. Complete one authenticated customer journey on this exact verified candidate: register/request link, email verification, login, plan path, test-mode checkout where appropriate, entitlement, dashboard, mobile navigation, deliberate sign-out and return.
2. Obtain written customer-display and derived-use rights for the selected CME ES and Cboe VIX feed, then perform a populated-session staging acceptance run.
3. Obtain final qualified privacy, risk-disclaimer and financial-promotion review for the intended launch jurisdictions and advertising copy.
4. Keep PR #37 draft and do not merge to `main` until Chris gives an explicit public-production approval after the above evidence is complete.

## Non-blocking maintenance recorded

GitHub issue #40 records post-beta maintenance without blocking the present launch candidate:

- pin the intended Node major range;
- plan the Next.js `middleware` to `proxy` migration without changing auth protection;
- refresh GitHub Actions dependencies whose older action runtime is being forced onto Node 24.

Do not mix this maintenance into the launch path unless it becomes a demonstrated blocker.

## Safety confirmation

- Production deployment: untouched
- `main`: untouched
- Live Stripe: untouched
- DNS: untouched
- Supabase configuration: untouched
- Secrets: untouched
- Provider integrations and entitlements: untouched
- ES/VIX safety logic: untouched
- PR #37: remains draft and unmerged
- Checkpoint creation: documentation-only save on a separate branch

## Recommended next action

Resume with the authenticated buyer-journey acceptance run on the exact private preview/candidate, while continuing to monitor vendor replies. Stop before any public deployment, live billing activation or provider connection unless the required evidence and explicit approval are present.
