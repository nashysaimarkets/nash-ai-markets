# Project Bullseye — current handoff

Last verified: **3 August 2026, 18:12 BST**

## Paste this into ChatGPT on another device

> Continue Project Bullseye from the verified private-staging checkpoint below. Work from `/Users/nashys/Desktop/nash-ai-markets-live` when that Mac workspace is available. Preserve the recovered interface, authentication, membership gates and fail-closed market-data behaviour. Inspect before changing anything, make one controlled change at a time, run proportionate tests, and do not deploy publicly or alter production services without explicit approval.

## Exact checkpoint

- Maintained checkout: `/Users/nashys/Desktop/nash-ai-markets-live`
- Active branch: `release/bullseye-launch-candidate`
- Verified application/staging commit: `141490cf509a8e2b55315f5104e672049e9cd59a`
- Current checkout: the verified application commit plus this documentation-only handoff commit
- Recovery branch: `checkpoint/bullseye-staging-v35-2026-08-03`
- Protected staging version: **35**
- Protected staging: `https://nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site`
- Repository state at handoff: clean; local release branch is 40 commits ahead of its configured GitHub upstream
- GitHub was not updated during the recovery and staging work

## What was recovered and repaired

- Restored the exact approved interface saved around 20:00 BST on 2 August; yesterday's work was not lost.
- Repaired the staging Supabase browser configuration without weakening authentication.
- Changed service-worker handling so updated scripts and styles do not remain trapped behind stale cache entries.
- Preserved automatic reuse of an existing authenticated session.
- Made Dashboard and Morning Brief open Trading Desk in ES Charts context instead of restoring an unrelated saved market.
- Clarified Free membership data status: the delayed ES quote is available; verified candle history requires Pro or Elite.
- Removed duplicated Morning Brief freshness wording.
- Refocused Journal copy on S&P 500 futures preparation rather than options.

## Authenticated staging evidence

The owner manually confirmed these protected routes on the exact staging origin:

- Dashboard
- Morning Brief
- Trading Desk with S&P 500 Futures (ES)
- Ideas, including its truthful zero-ideas state
- Reviews, including its truthful zero-reviews state
- Profile and Free membership status
- Preferences
- Private Journal with the correct Pro/Elite gate

The current automated gate passes **533 tests** plus the verified deployable Sites build.

## Safety and access boundaries

- Keep authentication, Supabase security, membership entitlements and billing gates intact.
- Do not fabricate quotes, candles, levels, confidence, performance, reviews, ideas, fills or outcomes.
- Free may receive the verified delayed quote; paid candle history must not be unlocked by presentation changes.
- Production, public access, Stripe activation, provider purchases, DNS, secrets and irreversible migrations remain out of scope without explicit approval.
- Private staging is healthy; public production remains **NO-GO** until the launch gates are completed.

## Recommended next work

1. Verify protected mobile and tablet layouts using the same immutable staging version.
2. Test deliberate sign-out, session return and passwordless-link expiry/reuse with minimal email sends.
3. Review the remaining customer copy for old multi-market or options-era language.
4. Keep populated candle-session acceptance blocked until an appropriate provider entitlement is deliberately approved.
5. Complete Stripe test-mode, monitoring, restore, legal and financial-promotion gates before considering a public launch.

## Recovery references

- Current verified checkpoint: `checkpoint/bullseye-staging-v35-2026-08-03`
- Previous verified staging checkpoint: `checkpoint/bullseye-verified-staging-2026-08-03`
- Pre-recovery release tip: `backup/pre-staging-recovery-2026-08-03`
- Historical 2 August interface checkpoint: `sites/staging-dashboard`
