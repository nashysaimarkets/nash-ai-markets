# Pocket Bullseye 1.2.4 — iOS release record

Verified: **5 September 2026 (UTC)**

## Pinned web application

| Field | Value |
|---|---|
| Git revision | `f037b98cd05ee8b1ef0fae0f026a088ca53ca7f9` |
| Branch | `prep/pocket-ios-1.2.4-build18` |
| Immutable Vercel URL | `https://nash-ai-markets-v54mgs3br-nash-ai-markets.vercel.app/pocket` |
| Vercel deployment | `dpl_4LT2Y2QSass3qTjNPzbSDkKVAEqZ` |

The build manifest returned the exact pinned revision and the deployment was Ready before the iOS release identity changed.

## iOS release identity

| Field | Value |
|---|---|
| Pipeline trigger | Release branch push (configuration enabled before this build) |
| Bundle ID | `com.nashaimarkets.pocketbullseye` |
| Marketing version | `1.2.4` |
| Build number | `18` |
| Subscription product | `com.nashaimarkets.pocketbullseye.monthly` |

## Included work

- Added deterministic multi-market chart measurement inside the existing Pocket Bullseye customer flow.
- Measures chart/candle structure in-browser before AI analysis.
- Uses corroborated chart evidence and avoids fabricated numeric levels.
- Preserves the current Pocket Bullseye layout and subscription flow.
- Keeps cross-platform and volume-profile detection conservative when evidence is insufficient.

## Release gates

- 924 unit tests passed in the verified acceptance build.
- 20/20 IG charts produced repeatable chart/candle extraction.
- Cross-platform set: 8/9 usable; one narrow Webull chart failed safely as inconclusive.
- Volume-profile candidates: 4/4 detected with corroboration required.
- TypeScript checks, lint, render checks and verified production build passed.
