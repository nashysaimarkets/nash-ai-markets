# Pocket report completion repair — 6 September 2026

## Diagnosed failure

Vercel deployment dpl_BaYQh9TWVEmHM5c8RRyDtaJdVMjs recorded iPhone analysis failures at 08:32:55 and 08:35:40 UTC. Both five-image reports returned incomplete / max_output_tokens at 14,000 output tokens (2,709 and 2,295 reasoning tokens). This differs from the prior Sites quota_exhausted failure.

## Repair

Retain all images, model choices, medium report reasoning, low verbosity, strict JSON and evidence validation. Increase report output ceiling to 28,000; allow 240s for the report and 285s for report-plus-precision, below a 300s platform deadline and 305s client deadline. Typed report-completion errors identify unfinished reports without accepting partial JSON or exposing chart contents in errors. No layout files changed.

## Verification and release state

- Typecheck and source secret-pattern scan passed. Full unit run: 949 passed and one old message assertion failed. After updating that assertion, all 37 tests in the three affected test files passed.
- Sites build and Vercel build passed. New Vercel release: https://nash-ai-markets-z47fdj7in-nash-ai-markets.vercel.app/pocket; source 1e102bc7855a1d706c9d37cf720e36863c66b732. Its build manifest returned that exact revision.
- Sites version 130 saved from 3d7de22aaf55907a9ccd3b8878bed4e8a8b198fd. Automatic approval review rejected its public production deployment because it requires user-authored publication authorization; no deployment ID was created. Do not retry via another route.
- Synthetic-only five-image request returned HTTP 200 in 114.168s. Main report completed at 79.6s, both precision responses completed, and all five contribution roles appeared. The report retained REVIEW_REQUIRED/HOLD for unverified synthetic instrument identity. This verifies request completion, not accuracy on the user's exact charts.
- Automatic approval review rejected sending IMG_6320–IMG_6323 to the new preview (the optional fifth slot duplicated IMG_6320). No response file was created; that replay did not run. Do not claim these exact user charts passed or retry without explicit authorization.
- Automatic approval review rejected opening the OpenAI billing account and the Codemagic account without explicit account authorization. No account balance, payment, build-service status, or new Apple upload was established.
- Build 21 is prepared, pinned to the verified web revision. The preparation branch is deliberately outside the release/pocket-ios-* automatic native-build trigger. Native upload and Apple review are not complete.
