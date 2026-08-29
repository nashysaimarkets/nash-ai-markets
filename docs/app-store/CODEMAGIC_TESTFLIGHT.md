# Pocket Bullseye — Codemagic TestFlight handoff

## Purpose

This workflow builds Pocket Bullseye on a current cloud Mac with Xcode 26 or later, signs it for App Store distribution and uploads the resulting IPA to TestFlight.

## One-time account connection

1. Create a free Codemagic individual account using GitHub.
2. Add `nashysaimarkets/nash-ai-markets` and select `codemagic.yaml` configuration.
3. In App Store Connect, create a dedicated API key named `Pocket Bullseye Codemagic` with the **App Manager** role.
4. Download the `.p8` key once and record its Key ID and Issuer ID.
5. In Codemagic, open **Team settings → Integrations → Developer Portal** and add the key under the exact integration name `Pocket Bullseye App Store`.
6. Allow Codemagic to generate the Apple Distribution certificate and App Store provisioning profile for `com.nashaimarkets.pocketbullseye`.

Never commit the `.p8` key, Issuer ID, signing certificate or provisioning profile to GitHub.

## Release trigger

The workflow runs only for tags matching `ios-v*`. The first TestFlight build should use `ios-v1.0.0-testflight.1` after the Apple integration has been connected.

## Expected result

- Signed `.ipa` retained as a Codemagic artifact.
- Build uploaded to App Store Connect and visible under TestFlight after Apple finishes processing.
- Production website remains untouched.

## Required verification before App Review

- Xcode compilation passes with the native StoreKit bridge.
- Sandbox product returns the localized £4.99 monthly price.
- First completed analysis remains free.
- Second analysis opens the Apple paywall.
- Purchase, cancellation, renewal, expiry and Restore Purchases are tested.
- Final App Store screenshots and subscription review screenshot are uploaded.
