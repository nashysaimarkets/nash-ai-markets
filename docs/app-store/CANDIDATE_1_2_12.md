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

## Pending production database migration

Read-only inspection found `public.pocket_growth_daily`, `record_pocket_growth_event`, and `pocket_growth_report` absent from that project. A marked test POST to `/api/pocket/activity` returned HTTP 503 with `recorded:false`.

The exact prepared migration is `docs/pocket-growth-schema.sql`, named `pocket_growth_daily`. It creates one daily-total table and two server-only functions, enables row security, revokes direct access from public/anonymous/authenticated clients, and grants only the server role the required access. It does not delete or rewrite existing customer records.

Automatic approval review rejected applying this production migration because specific approval for the database mutation was required. No schema was changed. Do not run it indirectly or treat the pending report as available.

After approval and migration, verify a marked test POST receives `recorded:true`, its daily total increments, test activity is excluded from the report, and anonymous/authenticated clients lack table and function access.

## Native release gates

Use the existing `pocket-bullseye-ios-stage-next` workflow to prepare a TestFlight binary. This workflow does not submit for App Store review. The regular release configuration retains automatic release after approval and never cancels existing submissions.

Before any App Store submission:

1. Check Apple's current version and review state and preserve any active review.
2. Confirm 1.2.12 (35) uploaded and processed successfully; record the actual Apple build ID. The older `staged-release.json` is historical and intentionally will not match this candidate pin, so the submit script fails closed until it is reconciled from verified Apple data.
3. On the candidate iPhone/TestFlight build, verify one free completed analysis, no free-use consumption for failed analysis, direct subscription entry after free use, repeated taps, cancelled purchase, successful sandbox purchase, restore, and opt-out persistence.
4. Reconcile App Store Connect privacy answers with actual collection, including anonymous product-interaction totals and scan-performance timing used for analytics. These new totals contain no customer/device/session identifiers and are not used for cross-app tracking. Preserve accurate disclosures for existing chart, account and purchase processing; do not replace them with an aggregate-only description.
5. Apply and verify the database migration described above.
6. Reconcile the staged build record and submit only the verified candidate, using automatic release after approval.

Apple's privacy guidance: https://developer.apple.com/app-store/app-privacy-details/

An uploaded binary, passing unit tests, or an in-app purchase event is not evidence of an App Store release or a paying customer. Native device and privacy checks are not established by browser or mocked tests.
