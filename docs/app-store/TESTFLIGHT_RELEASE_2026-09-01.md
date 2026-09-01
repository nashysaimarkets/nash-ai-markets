# Pocket Bullseye 1.1 — iOS release record

Verified: **1 September 2026 (UTC)**

## Pinned web application

| Field | Value |
|---|---|
| Git revision | `cd70fb6d6b52082d4afc16bae77877e6303a04ac` |
| Branch | `fix/pocket-v1-1-release-blockers-2026-09-01` |
| Immutable Vercel URL | `https://nash-ai-markets-4usvjc865-nash-ai-markets.vercel.app/pocket` |
| Build manifest | `https://nash-ai-markets-4usvjc865-nash-ai-markets.vercel.app/api/pocket/build-manifest` |
| Vercel deployment | `Df13PzRzVLK3scZ6hb7VwnDvfmuN` |

The manifest returned the exact pinned revision and the Vercel deployment was `READY` before the release identity was changed.

## iOS release identity

| Field | Value |
|---|---|
| Tag | `ios-v1.1.0-testflight.1` |
| Bundle ID | `com.nashaimarkets.pocketbullseye` |
| Marketing version | `1.1` |
| Build number | `11` |
| Subscription product | `com.nashaimarkets.pocketbullseye.monthly` |

## Included v1.1 work

- Full-image scanner preparation and coordinate normalization.
- Safer Level Lab recovery and fail-closed partial maps.
- Improved Liquidity Guard calibration and cross-image isolation.
- Interactive supplied-timeframe switching in Pattern Watch.
- Safe-area exits, keyboard/focus containment and paywall focus restoration.

## Release gates

- 888 unit tests passed.
- 8 render tests passed.
- Rendered production HTML test passed.
- Lint and TypeScript checks passed.
- Verified production build and artifact validation passed.
- Immutable build manifest matched the pinned Git revision.

The live 1.0 App Store version and the £4.99 monthly subscription remain unchanged until Apple accepts the 1.1 update.
