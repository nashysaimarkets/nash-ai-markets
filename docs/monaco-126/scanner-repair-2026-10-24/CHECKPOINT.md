# Pocket scanner repairs — 24 October 2026

## Outcome at this source checkpoint

The six-chart diagnostics exposed response truncation, a dropped observation field, and parent UI claims that did not consume source measurement. These corrections are now implemented in an isolated successor of `889feaa0768768d03b86f6db1664cb40321e5adf`, rather than remaining a documentary patch. Original six-case requests, provider responses, accounting and diagnostic findings remain unchanged.

**Local affected acceptance: 147 tests passed, zero failures or skips. Independent review: 131 overlapping affected checks and all retained-response controls passed. Browser lifecycle, whole-project typecheck and production compilation are pending the exact-source CI run at this checkpoint.**

## Changed behavior

- Precision primary and the existing conditional rescue share a 4,000-token output cap. Main and precision responses must actually be completed before their JSON is accepted. A failed or incomplete rescue preserves the completed primary; incomplete primaries never gain a retry or rescue. Main envelope, model selection, prompts and rescue predicate are unchanged.
- Calibration preserves the actual `observations` field. An explicitly supplied empty array survives the no-liquidity return. Missing, malformed or contradictory witness data does not become an invented empty array. The strict scorer is unchanged.
- One parent-owned measurement reads the original image and shares its result with the chart, map, story, health, provenance and level consumers. Verified claims refer specifically to pixel placement. Model candidates and semantic support/resistance judgments are not certified by that measurement.
- Replacing the image, report or confirmation immediately holds previous placement. Cancellation and late OCR completion cannot revive an earlier binding. Multiple views share the same measurement rather than starting duplicate OCR reads.
- Context prices without their own measured source result no longer enter the verified primary map. The context view explicitly holds placement. Independent Level Lab remains a separate source.

The existing OCR scale can legitimately correct a wrong model coordinate. Regressions demonstrate raw `y=40` becoming measured `y=65` without rewriting the original candidate. This is corrected placement, not proof that the model's original geometry or market interpretation was accurate.

## Evidence

- `AFFECTED-REGRESSIONS.json`: root's 147 actual local tests over 17 affected suites.
- `INDEPENDENT-SOURCE-REVIEW.json`: independent code review and immutable-source comparison.
- `UI-BASELINE-RED-CONTROL.json`: all six new consumer assertions fail against the base source and pass against the repaired source; no baseline runtime failures.
- `RETAINED-D001-PRECISION-CONTROL.json`: the actual retained truncated response is rejected without rescue or mutation.
- `RETAINED-D004-D005-CALIBRATION-CONTROL.json`: original completed responses pass through the candidate route merge/calibration and now normalize. Axis/level counts are 3/3 and 3/1; unrelated output geometry is unchanged. Historical hosted UNMEASURED records are preserved.

The browser harness uses actual React components, image loading, canvas and the existing projection function, with only OCR responses controlled. Its twelve planned scenarios exercise replacement, revocation, late responses, errors, shared views and unmounting. It does not measure real OCR or model accuracy.

## Reproduce and next acceptance

Run `node scripts/verify-pocket-scanner-repair.mjs` with the locked dependencies. It fails if any suite does not execute, has a failure or skips a test. The isolated branch's workflow repeats affected checks, checks all TypeScript, lints changed production files, runs Chromium lifecycle controls, and compiles the Next application. It has no provider credentials, protected inference environment or deployment step.

The retained-response verification scripts take local private artifact paths and output sanitized hashes/counts. Original input and response payloads are not copied into this repository.

**Still unmeasured:** whether 4,000 tokens reliably completes fresh precision outputs, actual endpoint latency, source accuracy on new outputs, semantic trading accuracy and released-device behavior. The unchanged 55-second provider timeout and 60-second route duration remain a potential constraint when a conditional rescue is needed. A future paid evaluation requires a newly versioned exact plan, request identities and cumulative accounting; the immutable old 1,400-token plan deliberately refuses this candidate.

## Preservation, scope and rollback

Root owns only `monaco-scanner-repair-126-20261024`, under Issue126 claim6383779885. Automatic Vercel deployment is disabled for this branch. PR142 and the previous six-case checkpoint remain untouched. Reverting this successor returns to the prior source; it must not rewrite historical artifacts or reopen old request slots.

This continuation has made zero provider calls and zero database changes. The carried-forward six-case receipt remains 14 genuine responses with a conservative held upper bound of $1.5064 in the original aggregate $5 allowance; actual billed dollars remain unknown. No budget reset or new paid authority is implied. The runner remains closed as last verified in the prior checkpoint, all schedules stay off, and the 44 held-out cases remain untouched.
