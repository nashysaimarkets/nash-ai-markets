# Pocket Bullseye — iOS TestFlight release record

Verified: **29 August 2026 (UTC)**

## Pinned web backend

| Field | Value |
|---|---|
| Git revision | `26c986ebd2a446a467cf63a643efc205d44eba66` |
| Branch | `feat/pocket-app-store-candidate-2026-08-29` |
| Immutable Vercel URL | `https://nash-ai-markets-hhi4ared3-nash-ai-markets.vercel.app/pocket` |
| Build manifest | `https://nash-ai-markets-hhi4ared3-nash-ai-markets.vercel.app/api/pocket/build-manifest` |
| Vercel deployment | `8WF3VtG7aDoLR3hNqFj7gC61Lcb3` |

Capacitor verification command:

```bash
eval "$(node scripts/load-release-pin.mjs)"
node scripts/verify-capacitor-server.mjs
```

Expected output:

```text
Verified immutable Pocket web revision 26c986ebd2a4 at https://nash-ai-markets-hhi4ared3-nash-ai-markets.vercel.app.
```

## iOS release identity

| Field | Value |
|---|---|
| Tag | `ios-v1.0.0-testflight.1` |
| Bundle ID | `com.nashaimarkets.pocketbullseye` |
| Marketing version | `1.0` |
| Build number | `1` |
| Subscription product | `com.nashaimarkets.pocketbullseye.monthly` |

## Codemagic trigger

After the App Store Connect integration named `Pocket Bullseye App Store` is connected in Codemagic, push the tag:

```bash
git tag ios-v1.0.0-testflight.1
git push origin ios-v1.0.0-testflight.1
```

The workflow reads `docs/app-store/release-pin.json`, verifies the immutable deployment, syncs Capacitor and uploads to TestFlight.

## Owner actions still required

1. Connect Codemagic to GitHub and add the Apple API key integration.
2. Complete App Store Connect app record, subscription group and £4.99 product.
3. Sandbox-test purchase, restore and the one-free-analysis gate on a physical iPhone.
4. Record the physical-device demo and attach it with `docs/app-store/APP_REVIEW_RESPONSE_2026-08-29.md`.
5. Upload screenshots and submit for App Review in App Store Connect.

Production Pocket (`pocket.nashaimarkets.com`) and web Stripe billing remain untouched.
