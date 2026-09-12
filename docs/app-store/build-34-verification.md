# Pocket Bullseye 1.2.11 (34)

## Verified source and web deployment

- Web source: `5ca5c0ab21a1f12303a53e5c25670c7a2fc87385`.
- Web tree: `76c777de7252552945a0f082a298b2df0103450a`.
- Vercel deployment: `dpl_9wcjWW5sSWGBKcoynFg6HVoJCqrn`, READY.
- Native URL: `https://nash-ai-markets-2mou7dt1n-nash-ai-markets.vercel.app/pocket`.
- Build manifest and `scripts/verify-capacitor-server.mjs` confirmed the exact source revision on 12 September 2026 at 15:55 UTC.
- Native version: 1.2.11, build 34, on `stage/pocket-ios-1.2.11-build34`.

The native release continues to use an immutable, verified web deployment. Native release preparation commits do not replace the web revision pin.

## Changes

This release includes the Bullseye Decision Engine, setup quality and evidence summaries, timeframe conflict and trap checks, conditions that change the analysis, screenshot integrity checks, and Analyse My Trade. The separate Independent Level Lab has been removed; automatic level recovery remains within the main scan. Background chart preparation and cached results support switching between completed timeframes.

## Verification

The verified web source passed 1,041 unit tests, 13 render tests, the production render test, type checking, production build, and mobile browser checks. Mobile checks found no horizontal overflow or browser errors and confirmed the duplicate lab was absent.

Native preparation passed type checking, the security scan, release-pin/version consistency checks, YAML workflow inheritance checks, and `git diff --check`. The staging workflow retains the existing dependency, unit, security, production build, revision verification, Capacitor sync, signing, and archive gates.

## Apple review preservation

The read-only Apple status workflow confirmed **1.2.10 (33) IN_REVIEW** on 12 September 2026 at approximately 16:01 UTC, with release type `AFTER_APPROVAL`. Build 33's Apple resource ID is `2aa80341-804e-4f67-8f9c-3c190b36ec70`.

Status evidence: <https://codemagic.io/app/6a90a2752815719e2161c656/build/6aa57758ee61e3e2ebe668ab>.

Build 34 must initially use `pocket-bullseye-ios-stage-next`, which uploads the signed binary without submitting it for App Review. It must not cancel or modify build 33's submission. The regular release workflow retains automatic submission, `cancel_previous_submissions: false`, and release after approval.

Uploading, processing, submission, and public availability must be recorded separately. At preparation time, build 34 has not yet been uploaded or submitted.
