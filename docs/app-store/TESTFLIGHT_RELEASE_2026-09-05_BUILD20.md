# Pocket Bullseye 1.2.5 — iOS build 20 release record

Verified: **5 September 2026 (UTC)**

## Pinned web application

| Field | Value |
|---|---|
| Git revision | `35ecba8263afc4510716a64e31f43dcb6815c4eb` |
| Branch | `release/pocket-ios-1.2.5-build20` |
| Immutable Vercel URL | `https://nash-ai-markets-q2xvj50p7-nash-ai-markets.vercel.app/pocket` |
| Vercel deployment | `dpl_BaYQh9TWVEmHM5c8RRyDtaJdVMjs` |

The build manifest returned the exact pinned revision and the deployment was Ready before the iOS release identity changed.

## iOS release identity

| Field | Value |
|---|---|
| Pipeline trigger | Release branch push |
| Bundle ID | `com.nashaimarkets.pocketbullseye` |
| Marketing version | `1.2.5` |
| Build number | `20` |
| Subscription product | `com.nashaimarkets.pocketbullseye.monthly` |

## Included work

- Increased and hardened precision-analysis completion budgets so verified levels are not lost to truncated provider output.
- Added automatic independent Level Lab and Liquidity Guard recovery when the primary scan cannot verify both sides or a defensible stop-risk zone.
- Preserved strict provenance and fail-closed validation: unreadable evidence is withheld rather than guessed.
- Fixed asynchronous iPhone file-input handling and same-file selection reset across all chart slots.
- Preserved the existing Pocket Bullseye layout and CSS geometry.

## Release gates

- 943 unit tests passed.
- TypeScript checks passed.
- Secret-pattern security scan passed across 898 version-control candidates.
- Verified production build and Sites artifact checks passed.
- Immutable Vercel build manifest matched the pinned Git revision.

The release branch was pushed only after all gates above completed successfully.
