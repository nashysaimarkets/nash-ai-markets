# Pocket Bullseye 1.2.9 build 30

## Release candidate

- Apple app: 6806004581 (`com.nashaimarkets.pocketbullseye`).
- Marketing version: 1.2.9; native build: 30.
- Native release branch: `release/pocket-ios-1.2.9-build30`.
- Verified web revision: `0e9d9b34046a90a973cbcde23df25bc2ba17f9d6`.
- Immutable web deployment: `dpl_HQ6nK6JetaQhwhCsM354oSDeRSRB`.
- Pinned URL: https://nash-ai-markets-53ybi2rmp-nash-ai-markets.vercel.app/pocket

## Changes

All uploaded chart reports prepare independently after the first result. Completed reports remain available immediately when switching timeframes. Slow active reports start one overlapping recovery after 60 seconds; either complete validated attempt can win. Verified measurements for the exact image bytes reduce repeated number estimation. Both report attempts retain medium reasoning and the full evidence pack. Existing precision checks, layout and native features are preserved.

## Verification before signing

1,020 unit tests, 13 render tests, TypeScript checks and the secret-pattern scan passed locally. The native source passed TypeScript and the 20 targeted report/measurement tests. The production bundle built successfully. The immutable deployment is READY and returns the exact pinned revision; `/pocket` returns HTTP 200. Browser checks confirmed the second and third sample selections update all timeframe controls and the written report.

## Apple handoff

The read-only Codemagic status job `6aa2548ae95b1cfe0d578f27` confirmed build 29 of version 1.2.9 is WAITING_FOR_REVIEW, with AFTER_APPROVAL release. Build 30 is intended to replace that pending submission. The existing App Store publishing workflow runs all release checks, verifies the pinned server revision, signs and uploads the IPA, waits for processing, then cancels the old pending submission and submits the new build with automatic release after approval. Submission outcome must be recorded after Apple confirms it.
