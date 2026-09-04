# Pocket Bullseye 1.2.2 build 17 — iOS release record

Verified: **4 September 2026 (UTC)**

## Pinned web application

| Field | Value |
|---|---|
| Git revision | `b78b47351a8f1b1d32774f46e84f2260bebeab0b` |
| Branch | `release/pocket-ios-1.2.2-build17` |
| Immutable Vercel URL | `https://nash-ai-markets-6mejayb0v-nash-ai-markets.vercel.app/pocket` |
| Vercel deployment | `dpl_BT4uuLaKU8niFETfEsNQpRr7K6xn` |

The build manifest returned the exact pinned revision and the deployment was Ready before the iOS build number changed.

## iOS release identity

| Field | Value |
|---|---|
| Tag | `ios-v1.2.2-testflight.2` |
| Bundle ID | `com.nashaimarkets.pocketbullseye` |
| Marketing version | `1.2.2` |
| Build number | `17` |
| Subscription product | `com.nashaimarkets.pocketbullseye.monthly` |

## Included work

- Refreshes the official macro-event schedule on launch, every five minutes and when the app returns to the foreground.
- Correctly accepts the live BLS `US-Eastern` calendar timezone and shows the US jobs report in UK time.
- Preserves symbol-specific company events while supporting a live general macro refresh.
- Independently scans every supplied chart image for pattern evidence.
- Associates each finding with its exact source image and coordinate system.
- Applies stricter geometry, confirmation and confidence gates to reduce false pattern labels.
- Limits each uploaded image to its strongest defensible pattern and returns no label when evidence is insufficient.

## Release gates

- 906 unit tests passed.
- The focused 44-test release suite passed after the event and pattern changes.
- TypeScript checks passed.
- Production build passed.
- Immutable build manifest matched the pinned Git revision.

## Signed build and Apple submission

| Field | Value |
|---|---|
| Codemagic workflow | `Pocket Bullseye — iOS TestFlight` |
| Codemagic build ID | `6a9a69f27f534af98018c3ea` |
| Build index | `13` |
| App Store build | `1.2.2 (17)` |
| Apple submission ID | `1ad589a9-558c-437b-880d-6aaf0972be2b` |
| Submitted | `2026-09-04 08:03 BST` |
| Status | `Waiting for Review` |

Build 16 was withdrawn after build 17 had completed validation, signing, upload and App Store processing. The App Store release notes were updated for the live event refresh and all-image pattern-analysis changes. Automatic release after approval remains enabled, phased release is off, and the existing rating is retained.
