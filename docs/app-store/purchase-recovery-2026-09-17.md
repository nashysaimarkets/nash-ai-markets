# iPhone purchase recovery — 17 September 2026

Chris reported that Subscribe and Restore did not work in the phone test flow and the subscription price appeared in dollars. The supplied screenshot shows the consumed-free-use notice, not the purchase sheet or an Apple error. The precise device failure has not been reproduced remotely; build 36 must not be submitted as validated.

## Changes

- Run StoreKit purchase and restore tasks on the main actor. Pass the bridge window scene to Apple's purchase confirmation API on iOS 17+, retaining the earlier API on older iOS.
- Reuse the loaded product at purchase, and resolve a restore from verified entitlements without a second product lookup. A verified purchase result is accepted even before the entitlement stream updates.
- Serialize native requests and reconnect the paywall to a still-pending request on reopening. Do not retry or falsely declare an unconfirmed payment cancelled.
- Show slow-request guidance and a bounded, read-only Check Apple Access action. Preserve native error details, move feedback above the buttons, and stop flex layout shrinking the controls.
- Add a direct subscription entry beside the consumed-free-use notice.
- Continue showing Apple's displayPrice. Remove the guessed native £4.99 fallback, expose the returned currency code, and label Apple's sandbox environment. Do not substitute a pound sign for an Apple dollar price.
- Enforce the existing physical-device customer-journey gate in staged submission; mark build 36's reported purchase/restore checks failed.

## Validation

Nineteen focused TypeScript tests passed, including real async coordinator tests for reattachment, duplication, cancellation, rejection and lock release. Type checking and secret-pattern scan passed. Ten release-preservation/device-gate tests passed. A native Xcode build and physical iPhone tests remain required; these source checks do not prove StoreKit purchases work on the owner's device.

## Currency evidence

Apple's product displayPrice is the authoritative formatted price. The sandbox account has its own storefront configuration. A recent unanswered developer report also describes TestFlight returning USD product metadata despite a European storefront; that is corroborating symptom evidence, not proof of this device's cause.

- https://developer.apple.com/documentation/storekit/product/displayprice
- https://developer.apple.com/documentation/storekit/product/purchase(confirmin:options:)-6dj6y
- https://developer.apple.com/help/app-store-connect/test-in-app-purchases/manage-sandbox-apple-account-settings
- https://developer.apple.com/forums/thread/845478
