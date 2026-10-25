# Release continuation: explicit Vercel build target

25 October 2026. Owner renewed approval to continue NTP integration and work toward release; Issue126 claim6395582434. Continue the existing isolated integration branch, not a new implementation. Prior writer released in6395525721 and remote head0f3d1d8c983f6e49d7a267d81fbe435921ad0c45 was verified before edits.

## Demonstrated configuration defect and repair

The recorded Vercel project has framework nextjs but does not expose an effective buildCommand. The accepted repository package build invokes the Sites/Vinext Worker wrapper. The existing vercel.json contained no explicit framework/build/output overrides. Consequently the candidate was relying on an unverified remote build override. This is a source configuration defect, not proof that an existing hosted deployment failed.

Set framework=nextjs, buildCommand=`node node_modules/next/dist/bin/next build --webpack`, outputDirectory=.next. This is the same direct Next/webpack command already accepted in run40177167084. The repository Next config uses the default output directory. No synthetic test environment, secret, provider enablement, install-command override or deploy command was added. The Sites npm build, all application source and all34 existing branch-deployment controls are unchanged.

Official configuration references checked25October2026: https://vercel.com/docs/builds/configure-a-build and https://vercel.com/docs/project-configuration. Per-deployment framework/build/output overrides are supported in vercel.json; no project billing/settings change was made.

## Actual checks

Exact connector baseline config was reproduced locally and its Git blob92533d4f6c1ddc56fa8808c3b493a4237b9a24d0 independently matched. Node22.16.0 targeted configuration suite: baseline5pass/2fail; candidate7pass/0fail/0skip. Candidate was rerun at its final repository path. Negative controls reject missing overrides, Worker build commands/output, static output and the wrong framework. A Git-blob comparison proves the previous unrelated configuration and all branch holds remain intact after removing just the three new fields. Receipt: VERCEL-BUILD-TARGET-RECEIPT.json.

Run `node --test docs/ntp/ntp-integration-2026-10-25/vercel-build-target.test.mjs` from the repository. It is dependency-free and calls no network, compiler or deployment. It deliberately lives beside this targeted acceptance packet rather than triggering the unchanged134-case application workflow. Existing134Node/HTTP/SSR and13phone-browser results remain evidence for unchanged application7432574, not freshly executed tests. No new full build or independent review is claimed.

## Release state and next action

This closes the missing source-level build-command selection only. The actual hosted build/interactive preview remains UNTESTED and the cost gate remains unresolved. Browser account access failed because this chat has no originating connected-browser context; no broker password/API key was requested or read. Prior runtime, IG DEMO API/rights, scanner semantic, signed-device, commercial/name and hosting gates in README.md remain unchanged. Renewed approval is not an acceptance result or a new spending amount.

Next executable integration work is real runtime/bootstrap and identity binding in an appropriately isolated existing host environment, followed by its authenticated acceptance. Do not launch the services-disabled HTML as a working scanner or claim the configured command has been deployed. No existing customer records, main, pricing, schedules or44held-out cases were changed.

Rollback: restore vercel.json from0f3d1d8; this session made no live change. The final Issue126 receipt supplies the resulting immutable commit/tree and releases this bounded branch claim.
