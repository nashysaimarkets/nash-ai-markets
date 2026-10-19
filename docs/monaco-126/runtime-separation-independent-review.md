# Independent benchmark/runtime scope review

19 October 2026. Read-only source review under issue126 and root-owned PR127. No provider request, credential operation, database operation, deployment or security-gate change was performed.

**Conclusion:** An isolated six-case benchmark needs attestation of its own authorised executor's existing intended project/key/model and unchanged financial controls. It does not require proof of the concealed live Sites key unless the claim being tested is specifically that live Sites runtime. This is an inference from the execution paths below, not a provider/runtime identity PASS.

| Source | Evidence and implication |
| --- | --- |
| `scripts/run-pocket-real-image-benchmark.ts` | Imports the local `app/api/pocket/analyse/route.ts` POST and calls it with a localhost Request inside the benchmark spend scope. It does not send the benchmark to the public Sites application. Rights/second-review, dispatch hold, per-case measurements and settlement checks remain explicit. |
| `app/api/pocket/torture/provider-spend.ts` | `withPocketTestSpendScope` verifies runtime metadata, compares it with independently reviewed ledger configuration, claims the complete case reservation, and only then enters the provider scope. Project, owner approval, candidate, model bounds and per-call receipts are checked. |
| `app/api/pocket/torture/runtime-metadata.mjs` | Reads only fixed-origin HTTPS metadata via GET with no redirects/retries. It checks the existing intended organisation/project/tracking ID, unique redacted key correlation, exact model, backend reference, candidate string, enabled metadata flag and absence of an alternate API origin. It has no requirement for Sites project ID/version/environment or concealed Sites-key equality. Current implementation requires both the existing runner project key and existing read-only administrator metadata access. |
| `app/lib/server/openai.ts` and `app/api/pocket/analyse/route.ts` | The actual client uses that process's `OPENAI_API_KEY`, no automatic retries, and the benchmark scope's project; main/annotation requests use the configured snapshot. The isolated executor must therefore attest the same process configuration actually used for inference. |
| `scripts/verify-pocket-benchmark-isolated.sh` | Configures one child process's intended project, both exact mini snapshots, accounting mode and backend while forcing paid pilot/real-dispatch flags false. It changes no Sites setting and accesses no concealed Sites secret. |
| `supabase/migrations/20261014113000_pocket_benchmark_pilot.sql` | Runtime evidence must match the independently reviewed ledger's key fingerprint/tracking ID, project, candidate, model and backend and be no more than five minutes old. Approval/cap/reservation/receipt/settlement controls remain separate. Metadata evidence explicitly does not settle charges. |

## Gates that remain

- **Actual capability:** the unchanged verifier needs an authorised non-deploying execution context where the intended existing project key and read-only administrator metadata access already reside securely. A signed-in browser's dashboard inventory does not delegate those credentials. No substitute key was created, exported, requested or proposed here.
- **Shared-live database:** the wrapper still points at `pxlqvaddvghjjhenqmdh`, also used by live Sites. Isolated computation is not database isolation. Installing/enabling ledger structures or configuration still needs the precise shared-live approval, impact, timeout/atomic/rollback and independent QA gates.
- **Financial evidence:** the immutable aggregate $5 scope, full worst-case reservations including rescue/retry paths, separate historical $2 history, exact request-linked receipts and independent actual-charge evidence remain unchanged. A reservation, metadata read or model access result cannot be renamed settled cost or release acceptance.
- **Source identity:** the wrapper pins implementation `93f3fe282c6cab0196812aec989dddaa915bb986`. A new PR127 checkout is not that implementation. Use the exact approved source, or a separately reviewed candidate/configuration change consistent with immutable approval scope. Never label measurements from new code with the historical SHA; environment variables alone do not attest the loaded source tree.
- **Corpus and release:** genuine licensed source charts, required six canonical cases, independent labels and genuine provider measurements remain separate. An isolated provider PASS would not verify live Sites source, its current Sol/Terra model overrides, native backend, StoreKit or Android.

## Support clarification scope

Root reports an AI-assisted reply in support case17703606 says no operator capability is available and suggests a same-key metadata GET such as `/v1/me`. The reply and endpoint capability were not independently attested in this task. The current reviewed verifier implements administrator project/key inventory plus a model GET; it does not implement `/v1/me`. This review makes no claim that the suggested endpoint is supported for the intended key or returns enough non-secret correlation evidence. Any alternative must be documented and independently assessed against the same identity/evidence requirements before adoption.

The useful clarification is to identify live Sites as its own concealed-key runtime and ask for a supported non-deploying, same-runtime, non-secret metadata method there. That support question is separate from access to an existing authorised isolated benchmark executor. No email was sent in this task, and no gate was weakened to accommodate either environment.

Related retained checkpoint: [runtime access](../quality/pocket-runtime-access-2026-10-19.md). Its final wording about a single missing capability should be read with the two scopes distinguished above; it does not establish that Sites-key attestation is a dependency of the isolated local runner.
