# Pocket Bullseye 1.2.3 — iOS release record

Verified: **4 September 2026 (UTC)**

## Pinned web application

| Field | Value |
|---|---|
| Git revision | `0344ae24f03d5af5e7aab89840ae38a321d38abd` |
| Branch | `release/pocket-ios-1.2.3-build17` |
| Immutable Vercel URL | `https://nash-ai-markets-4piyil6x9-nash-ai-markets.vercel.app/pocket` |
| Vercel deployment | `dpl_H8U7qZJHxhLzUJzpdmU4NcfjKsCi` |

The build manifest returned the exact pinned revision and the deployment was Ready before the iOS release identity changed.

## iOS release identity

| Field | Value |
|---|---|
| Pipeline trigger | Release branch push (configuration enabled before this build) |
| Bundle ID | `com.nashaimarkets.pocketbullseye` |
| Marketing version | `1.2.3` |
| Build number | `17` |
| Subscription product | `com.nashaimarkets.pocketbullseye.monthly` |

## Included work

- Fixed the live BLS calendar timezone alias so same-day Employment Situation/NFP events appear correctly in UK time.
- Prevented stale in-app calendar snapshots after a new analysis.
- Scanned every uploaded image independently for defensible chart-pattern evidence.
- Strengthened pattern geometry checks so overlays remain tied to their source image.
- Recognised tight near-equal high and low liquidity clusters without requiring identical wick pixels.
- Added an explicit `AT CURRENT PRICE` liquidity state so a valid zone does not disappear while price tests it.

## Release gates

- 909 unit tests passed.
- TypeScript checks passed.
- Verified production build passed.
- Immutable build manifest matched the pinned Git revision.
