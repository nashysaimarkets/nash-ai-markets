# Pocket Bullseye iOS launch checklist

## Completed in source

- [x] Protected iOS release branch created.
- [x] Capacitor 8 iOS project generated.
- [x] Bundle identifier set to `com.nashaimarkets.pocketbullseye`.
- [x] Native camera, photo selection, haptics, sharing, application and preferences packages added.
- [x] App icon master installed at 1024 × 1024.
- [x] Camera and photo-library purpose strings added.
- [x] Export-compliance declaration set for standard exempt encryption.
- [x] StoreKit bridge, purchase, restore and current-entitlement checks implemented.
- [x] One completed free analysis is recorded in this-device-only Keychain storage.
- [x] Every additional native AI request fails closed behind the Apple entitlement gate.
- [x] Native PWA installation prompts and external web checkout paths are suppressed.
- [x] Host privacy manifest declares the verified Capacitor Preferences `UserDefaults` reason.
- [x] Clean CI builds and validates the web artifact before Capacitor synchronisation.
- [x] Capacitor has no default production URL; CI verifies an immutable preview URL against its exact Git revision before synchronisation.
- [x] App Store listing, review notes, privacy draft and subscription identifiers prepared.

## App Store Connect

- [ ] Accept any pending Apple agreements.
- [ ] Create the app record with the identity in `APP_STORE_CONNECT.md`.
- [ ] Create the `Pocket Bullseye Access` subscription group.
- [ ] Create the £4.99 monthly subscription product.
- [ ] Add subscription localisation and review screenshot.
- [ ] Complete banking and tax agreements if Apple requests them.
- [ ] Complete App Privacy answers after final production verification.

## Engineering and verification gates

- [x] Show the Apple paywall only after the first completed analysis.
- [x] Keep the accountless iOS StoreKit flow separate from web Stripe offers.
- [ ] Add server-side StoreKit transaction/JWS verification, App Store Server Notifications and App Attest before relying on the public API as the entitlement security boundary. This requires real App Store Connect issuer/key material and must not be simulated in source.
- [ ] Add server-side per-device/app-attestation rate controls for the public analysis endpoints. The current native gate is enforced in the client UI; direct API access remains a separate hardening item.
- [ ] Test purchase, renewal, cancellation, billing retry, expiry and restore in Sandbox.
- [ ] Push the final web revision and wait for its immutable Vercel deployment URL.
- [ ] Verify that deployment end to end, then set `CAPACITOR_SERVER_URL` to its `/pocket` URL and `CAPACITOR_SERVER_REVISION` to the exact 40-character deployed Git SHA in Codemagic before starting the archive.
- [ ] Retain the build-manifest verification output with the TestFlight evidence; never substitute the mutable production domain or a `-git-` branch alias.
- [ ] Build and archive on a signed Mac/Xcode installation.
- [ ] Upload to TestFlight and complete an iPhone regression pass.
- [ ] Attach final screenshots, build and subscription to the App Store version.
- [ ] Submit for App Review.

## Release protection

Production version 109 remains untouched until the iOS entitlement path passes its full test matrix.
