# Pocket Bullseye iOS launch checklist

## Completed in source

- [x] Protected iOS release branch created.
- [x] Capacitor 8 iOS project generated.
- [x] Bundle identifier set to `com.nashaimarkets.pocketbullseye`.
- [x] Native camera, photo selection, haptics, sharing, application and preferences packages added.
- [x] App icon master installed at 1024 × 1024.
- [x] Camera and photo-library purpose strings added.
- [x] Export-compliance declaration set for standard exempt encryption.
- [x] App Store listing, review notes, privacy draft and subscription identifiers prepared.

## App Store Connect

- [ ] Accept any pending Apple agreements.
- [ ] Create the app record with the identity in `APP_STORE_CONNECT.md`.
- [ ] Create the `Pocket Bullseye Access` subscription group.
- [ ] Create the £4.99 monthly subscription product.
- [ ] Add subscription localisation and review screenshot.
- [ ] Complete banking and tax agreements if Apple requests them.
- [ ] Complete App Privacy answers after final production verification.

## Engineering gates

- [ ] Add StoreKit 2 purchase, restore and entitlement synchronisation.
- [ ] Add server-side App Store transaction verification and notifications.
- [ ] Add account-bound one-free-analysis claim with an atomic database function.
- [ ] Show the Apple paywall only after the first completed analysis.
- [ ] Ensure Stripe and Apple subscriptions resolve to one Pocket entitlement.
- [ ] Prevent duplicate Apple/Stripe subscriptions for the same signed-in account.
- [ ] Test purchase, renewal, cancellation, billing retry, expiry and restore in Sandbox.
- [ ] Build and archive on a signed Mac/Xcode installation.
- [ ] Upload to TestFlight and complete an iPhone regression pass.
- [ ] Attach final screenshots, build and subscription to the App Store version.
- [ ] Submit for App Review.

## Release protection

Production version 109 remains untouched until the iOS entitlement path passes its full test matrix.

