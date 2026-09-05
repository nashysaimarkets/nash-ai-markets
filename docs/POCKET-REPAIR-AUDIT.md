# Pocket repair audit — 5 September 2026

## Preserved baseline

Version 126 remains an archive-backed recovery point; see POCKET-V126-RECOVERY.md. This repair preserves page structure, control placement and orbital effects. Chris requested the existing smallest text be modestly enlarged.

## Reproduced and repaired

- The recording's US 500 USD preflight identity did not match the same chart's US 500 (DFB) title. A narrow explicit alias now recognizes this display variation. Different instruments, currencies, futures and ETFs remain distinct.
- Automatic preflight readings were treated as trader-confirmed facts and could override independently read prices. Only an explicit user confirmation now grants that authority. Preflight reads the primary image at high detail and is told to preserve the visible title.
- Analysis cache version 15 expires results created before these evidence corrections.
- Text below 11px is raised to 11px. Existing header-caption tracking is tightened to keep it within the same header.
- Level Lab now reports service failures without wrongly blaming chart clarity. Provider completion metadata is logged without uploaded images or chart content; the structured response output allowance is increased.

## Verification completed

- Complete unit suite: 947 passed, 0 failed, 0 skipped.
- Render checks: 10 passed.
- Typecheck passed; production build passed before final packaging cleanup.
- Real markup/CSS checked at 375, 390 and 430px frames. Document scroll width matched its client width; visible text floor was 11px. This is browser width verification, not an actual iPhone hardware run.
- Reviewed the 8m50s Safari recording: completed analysis, cinematic/written views, liquidity and pattern maps, timeframe controls, repeated Level Lab rejection and follow-up interaction.

## Live checks still open at this checkpoint

- The baseline Level Lab replay returned HTTP 502 in about 1.7 seconds. That is separate from the recorded HTTP 422 name mismatch. The updated diagnostics must be used to establish whether the repaired service completes a real scan.
- End-to-end real AI results, follow-up and auxiliary scan routes need replay against the repaired release. Automated tests alone do not establish visual analysis accuracy.
- The optional FMP calendar feed returns 402. The existing official-source fallback returns partial coverage; no subscription change was made.

No claim is made that every possible chart, provider response or iPhone interaction is error-free. Current Apple review status and payment transactions were not changed by this web repair.

## Saved release and interruption recovery

- Saved version 127: `appgprj_6a6efa569218819185b3eefd3c508e66~appgver_e9eaca73c5c48191b4349b06cc0b42ff`.
- Exact source: `eafe8080b0e0eb9d759a720a2ccaf4c2f1dbf1a6`.
- Clean production build and packaging succeeded; temporary browser QA files were removed before that build.
- Artifact hash: `sha256:f3fcee9cf68aa6c10e5a86b19be5a40c0d1dd624a11a44e412748c0c2aef8735`.
- Automatic approval review rejected production deployment because it found no explicit publication approval for version 127; the earlier explicit approval named 125. No deployment ID was created. Do not retry through another route without authorization.
- Version 126 remains the live release. Next: obtain the required version 127 publishing approval, deploy the saved archive, then replay the attached 30m chart against Level Lab and inspect the new completion diagnostics before declaring the live fix verified.
- Local replay fixture: `/workspace/scratch/c5ade6897288/qa/level-recorded-request.json`. It contains the recorded 30m chart and primary provenance US 500 USD / UNKNOWN / 5m / 7709.19; this reproduces the old preflight identity/price rather than certifying those readings as correct.
- Original chart files 6320–6323 are under `/workspace/scratch/13c6f839950e/upload/`. User video is 529.9 seconds; main scan completes, but Level Lab repeats the mismatch rejection.

The user's 23:42 screenshot shows ChatGPT Work's "Reasoning failed" message. It does not identify the underlying cause. OpenAI's public status page reported fully operational when checked; that does not rule out a session-specific failure. This checkpoint prevents the app repair state from depending on the chat remaining connected.

## Authorized publication and service findings

Chris subsequently authorized all related site and Apple updates. Version 127 deployed successfully as `appgdep_6a9c9c152200819182205ca2317136a7`, environment revision 30. The saved version and recovery checkpoint remain available.

The real Level Lab replay `req_4774185a08674898` failed in 1,584ms with the safely classified provider reason `quota_exhausted`. This is independent of chart identity validation and cannot be repaired by weakening evidence checks. OpenAI billing requires an interactive account sign-in; its balance and exact limit are not yet visible. No charge or limit increase has been made. The follow-on repair returns a non-retryable capacity response, and recognizes the documented credit, project-spend, organization-spend and organization-usage codes separately from transient rate limiting.

An untracked phone-width QA HTML file was unexpectedly present in the version 127 archive despite removal before the build. It contains only a local rendering harness, no credentials or user charts. It has been removed from source and build output; the next archive must be built from a clean tracked checkout and explicitly checked for its absence.

Apple build 20 was uploaded and processed by App Store Connect as `bd595895-0002-46f6-af70-1e3b67e0e71c`, app `6806004581`. Codemagic build `6a9c8d3452f435e837b2c1fb` failed only at beta review submission: Apple returned 422 because another build in the same version train is already in beta review. App Store Connect's browser session is logged out. Do not describe this as an App Store release or cancel the existing review without a reason.

## Latest durable checkpoint

- Capacity handling repair source: `4048b43358a14de6bdd29a22e83aa10fd8251e84`, pushed to the Pocket Sites source main branch. Full suite: 949/949 passed; typecheck and secret-pattern scan passed.
- Equivalent application repairs also saved to GitHub branch `fix/pocket-final-release-2026-09-05`, source `479b2459d5c2344e04a8f8dda61822271346a1c2`.
- Vercel built that branch successfully: `dpl_G1gVyPCphxZ8mAbtj9YUtC1yDqFU`, https://nash-ai-markets-mj2yvwoqn-nash-ai-markets.vercel.app. Main production has not yet been advanced to this revision; Apple build 20 is still pinned to its older immutable deployment.
- Clean Sites build checkout: `/workspace/scratch/c5ade6897288/pocket-clean-build`; build log `/workspace/scratch/c5ade6897288/qa/clean-v128-build.log`. Check completion before packaging; no saved version 128 exists yet. Version 127 remains live.
- OpenAI billing browser access reached the login screen. No balance, exact limit, account identifier or payment amount was established. User needs to sign into the API billing account or provide screenshots of billing balance and Limits before a precise restoration action can be taken. No purchase or limit increase is authorized by an invented amount.
- The latest ChatGPT screenshot says "Streaming interrupted. Waiting for the complete message...". It establishes an interrupted reply stream, not its cause; there is no evidence connecting it to Pocket's API quota.
