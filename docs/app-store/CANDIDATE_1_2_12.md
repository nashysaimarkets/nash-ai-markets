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

The verification used the pinned candidate and found exactly one matching build. Apple still listed 1.2.11 as READY_FOR_DISTRIBUTION / READY_FOR_SALE; no 1.2.12 App Store version appeared. The staging workflow uploaded this binary without submitting it to App Review. Automatic release after approval and preservation of existing submissions remain configured.

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
2. Reconcile App Store Connect privacy answers with actual collection, including Product Interaction and Performance Data for Analytics, unlinked and not used for tracking. These new totals contain no customer/device/session identifiers. Preserve accurate disclosures for existing chart, account and purchase processing. App Store Connect remained signed out at the latest check; the earlier secure sign-in attempt failed and a manual browser handoff was requested. No privacy update has been made.
3. Refresh Apple's current version and review state immediately before submission and preserve any active review.
4. Reconcile the historical `staged-release.json` only after the device and privacy gates pass, using the verified build ID above and predecessor 1.2.11. Until then it intentionally does not match the new candidate pin, so submission fails closed.
5. Submit the verified existing candidate using automatic release after approval; record Apple's submission and release states separately.

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

An uploaded binary, passing unit tests, or an in-app purchase event is not evidence of an App Store release or a paying customer. Native device and privacy checks are not established by browser or mocked tests.
