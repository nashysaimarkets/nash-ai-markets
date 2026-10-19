# Canonical scanner benchmark coverage audit — issue #126

Base source: `b02d5dd7a44c61fbdb6d99c60e365700d9f66d92`.
Audited recovered `prepared/DISPATCH-SAFETY-MANIFEST.json` SHA256:
`442e7c30344825afb51908de855c37ca752429260c533d676c5d1de1210ff9dc`.
No immutable fixture, original hash pin, price or licence statement was modified.

**Six recovered inputs do not establish six canonical scenario acceptances.**
The recovered file labels match three owner-required cases. A sweep/reclaim is
not a bear flag merely because both use 5m; a negative variant needs explicit
independent semantic acceptance before it satisfies the canonical no-signal case.

| Owner-required case | Recovered source | Metadata result | Exact remaining dependency |
| --- | --- | --- | --- |
| Range-clear 30m | `range-clear-01` | PRESENT AS DECLARED | Licensed source and second annotation; actual scanner measurement |
| Double-top 1h | `double-top-01` | PRESENT AS DECLARED | Licensed source and second annotation; actual scanner measurement |
| H&S 4h | `head-shoulders-01` | PRESENT AS DECLARED | Licensed source and second annotation; actual scanner measurement |
| Bear flag 5m | `sweep-reclaim-01` is a different declared structure | MISSING | Source-authorised, independently labelled bear-flag raster and pinned input |
| Wedge 15m | None | MISSING | Source-authorised, independently labelled 15m wedge raster and pinned input |
| Negative / no-signal | `near-miss-chop-01`, `degraded-no-signal-01` are review candidates | SEMANTIC ACCEPTANCE BLOCKED | Independent annotator must establish which existing variant meets the intended negative test; otherwise supply a canonical negative raster |

All six recovered inputs declare **upstream source/feed rights unverified**.
Owner/source licensor must supply attributable rights for the intended analysis,
provider processing and any redistribution. No grant is inferred from recovery
of the files or from their provisional internal-QA label. A second independent
chart annotator must review source provenance and reference annotations. These
are independent gates even for the three matching declared scenarios.

## Separate evidence dimensions

- Existing strict adapter integrity: **6/6 recovered original PNG/input pairs
  passed**, as separately executed by the release integrator. The new metadata
  checker does not repeat or attest those byte/hash checks.
- Canonical declared metadata: **3/6 exact matches**; missing bear flag 5m and
  wedge 15m; the negative case has two explicit review candidates, not silent
  substitution or a mandatory claim that both are unsuitable.
- Genuine provider scanner measurements: **0/6, UNMEASURED**. Hash validation,
  offline metadata and reference annotations are not provider accuracy results.
- Source rights and second annotation: **BLOCKED** pending independent evidence.

## New offline checker

`scripts/pocket-monaco-corpus-coverage.ts` is a pure, non-dispatching audit. It
matches declared scenario and timeframe, exposes negative review candidates,
rejects invalid/duplicate case or content identities, and lists named dependency
owners. It never reads a fixture, touches credentials, calculates price evidence,
accepts a free-text licence assertion, verifies provider receipts or grants
dispatch permission. Even complete canonical metadata retains `status: BLOCKED`
and `dispatchAuthorised: false`; external acceptance remains separate.

```sh
node --test tests/pocket-monaco-corpus-coverage.test.ts
# 7 PASS, 0 FAIL, 0 SKIPPED
```

Tests cover recovered scenario mismatch, positive complete metadata, incorrect
timeframes, duplicate identities and raster hashes, ambiguous choices, malformed
manifests, and unsupported rights/annotation/provider claims. Test hashes are
synthetic metadata only, with no image, price or permission evidence.

Resumption: add licensed bear-flag and wedge source inputs without overwriting
the existing six immutable files; record independent negative-case acceptance
in a separate review/mapping artifact bound to original/input hashes. Retain the
strict original adapter, finance/runtime gates, and existing provider count until
real, attributable measurements are accepted. The negative mapping must receive
review before any dispatch; this checker does not create or approve it.

Rollback: remove the new audit module/test/document only. No runtime, schema,
fixtures, corpus pins or provider state were changed.
