# Pocket Bullseye 1.2.12 (35) candidate

Prepared on 15 September 2026 from PR #82, commit `56dc2eb4c926378db79dad17399afaedca92611d`.

## Verified web source

- Immutable deployment: `dpl_46MQrK92MtzR3EohcyV2N8gP7whD`.
- Native server: https://nash-ai-markets-hunxt757k-nash-ai-markets.vercel.app/pocket
- Its public build manifest returned the exact PR #82 revision.
- The deployed login page identifies the native Supabase project as `opmgzchnmcgnsfwpmysc`.

## Validation

All 1,045 unit tests, type checking, secret scanning, and the verified production build passed. The nine review-preservation tests passed. Capacitor sync completed and its generated configuration pointed to the exact verified native server.

The first local build timed out while using a shared dependency symlink; a clean local dependency copy completed successfully. Generated machine-specific Swift package paths were restored to the existing portable relative paths.

Native StoreKit device checks remain pending and are not implied by these automated passes.

## Processed Apple build

- Candidate: **1.2.12 (35)**.
- Apple build ID: `e57995be-c2f3-429c-b24d-d43b6b35da5c`.
- Apple processing state: **VALID**, `expired: false`.
- Native build commit: `2a75f41c1da86e1a9618270ad020d5d68dcfba4f`.
- Upload completed without errors at 17:24:31 UTC on 15 September 2026.
- Finished staging run: https://codemagic.io/app/6a90a2752815719e2161c656/build/6aa97cee48382671285799f9
- Finished read-only verification: https://codemagic.io/app/6a90a2752815719e2161c656/build/6aa9800f284f8dfd188e8920

The verification used the pinned candidate and found exactly one matching build. Apple listed 1.2.11 as READY_FOR_DISTRIBUTION / READY_FOR_SALE. At that earlier check there was no 1.2.12 App Store draft; the authenticated continuation below subsequently created it. The staging workflow uploaded this binary without submitting it to App Review.

## App Store preparation completed

Apple account access succeeded on 15 September 2026. At 18:22 UTC the saved [1.2.12 draft](https://appstoreconnect.apple.com/apps/6806004581/distribution/ios/version/inflight) showed **Prepare for Submission** with build **35**, whose link identifies the exact Apple build ID above. The English (U.K.) What's New field matches `release_notes.json`. Existing screenshots, description and review information were inherited. **Automatically release this version** is selected, with immediate availability to all users after approval and existing ratings retained. Save was disabled after completion; Add for Review was available but was not selected.

The App Review page showed the latest 1.2.11 submission as **Review Completed**, with no active review displayed. Version 1.2.11 remains the released version. The new draft is not an App Review submission or a release.

### Published privacy declarations

At approximately 18:14 UTC, [App Privacy](https://appstoreconnect.apple.com/apps/6806004581/distribution/privacy) showed the update as published by Chris Nash, with eight configured data types and no incomplete-setup warning.

| Data type | Purpose | Linked to identity | Tracking | Change |
| --- | --- | --- | --- | --- |
| Product Interaction | Analytics | No | No | Added and published |
| Performance Data | Analytics | No | No | Added and published |
| Email Address, Customer Support, User ID, Purchase History | App Functionality | Yes | Existing answers preserved | Preserved |
| Photos or Videos, Other Diagnostic Data | App Functionality | No | Existing answers preserved | Preserved |

The new aggregate events contain no customer, device or session identifiers. This does not describe all collection by the app; existing chart, account and purchase disclosures remain in place. The privacy-policy URL remains `https://www.nashaimarkets.com/privacy`.

### TestFlight preparation

[Build 35](https://appstoreconnect.apple.com/teams/e94ce30a-fffc-4aaa-b644-f23c6759fd7a/apps/6806004581/testflight/ios/e57995be-c2f3-429c-b24d-d43b6b35da5c) was already assigned to Pocket Bullseye Internal Testers, containing one existing tester. No invitations or access changes were made. Apple showed **1.2.11 (34)** installed on that tester's iPhone 16, iOS 26.6.2; this does not verify installation or testing of 35.

The build's What to Test field was saved with the exact checklist in `TESTFLIGHT_1_2_12.txt`. It asks for device and iOS details, sandbox purchase checks, persistent opt-out before the remaining activity, and explicit not-tested results where existing allowance or subscription state prevents a check. Do not reset customer data to force a test. TestFlight alone does not automatically mark aggregate events as tests.

## Production reporting verified

Chris explicitly approved the prepared production update on 15 September 2026, resolving the earlier automatic approval-review rejection. The exact `docs/pocket-growth-schema.sql` migration, named `pocket_growth_daily`, was then applied successfully to `opmgzchnmcgnsfwpmysc`.

Verification through the pinned deployed app and database established:

- A marked `sample_viewed` / `apple` / `sample` event returned **HTTP 200, `recorded:true`**, replacing the pre-migration HTTP 503 result.
- Its `other` / `other` daily test total was exactly **1**, with duration total **0 ms**.
- There were no non-test rows at that observation; the customer report returned empty `events` and `sources`, excluding the test.
- Row security is enabled. Anonymous and authenticated roles cannot select, insert, update, delete, or execute either reporting function. The server role has the required access.
- Both functions use invoker security with an empty search path.

The migration creates reporting objects and does not delete or rewrite existing customer records. These counts are actions, not unique people or verified Apple sales. The empty report does not establish zero visitors or customers.

## Remaining native release gates

Before any App Store submission:

1. Complete the actual iPhone/TestFlight checks below on **1.2.12 (35)** and record the device, iOS version, date, and observed results.
2. Refresh Apple's current version and review state immediately before submission and preserve any active review. The privacy gate above is complete.
3. Reconcile the historical `staged-release.json` only after the device checks pass, using the verified build ID above and predecessor 1.2.11. Until then it intentionally does not match the new candidate pin, so the submission workflow fails closed.
4. Submit the verified existing candidate using automatic release after approval; record Apple's submission and release states separately.

| Device check | Required result | Status |
| --- | --- | --- |
| Completed free analysis | One successful analysis consumes the free allowance; its result is usable. | Pending |
| Failed free analysis | A failed analysis preserves the free allowance. | Pending |
| Subscription entry after free use | The subscription screen opens directly. | Pending |
| Repeated purchase/restore taps | Only one operation runs at a time. | Pending |
| Cancelled purchase | No paid entitlement is granted; the screen remains usable. | Pending |
| Successful sandbox purchase | Paid access becomes available through the actual native purchase flow. | Pending |
| Restore | The existing test purchase restores access through the actual native restore flow. | Pending |
| Usage opt-out | The choice survives closing and reopening the app, and counting stays disabled. | Pending |

Apple's privacy guidance: https://developer.apple.com/app-store/app-privacy-details/

An uploaded binary, saved App Store draft, passing unit tests, or an in-app purchase event is not evidence of an App Store release or a paying customer. Native device behavior is not established by browser or mocked tests.
