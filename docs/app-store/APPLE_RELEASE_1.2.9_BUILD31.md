# Pocket Bullseye 1.2.9 build 31 — prepared, not submitted

The 10 September scan failure is documented in `docs/pocket-scan-completion-2026-09-10.md`.

- Web revision: `51c260fa80d40e47f94d1d9796f0eff2e0b94a16`.
- Vercel deployment: `dpl_2xDyeUVFwbwRptPuBd8THAggvGoz` (READY).
- Pinned URL: https://nash-ai-markets-q0asynfvc-nash-ai-markets.vercel.app/pocket
- Build manifest returned the exact revision and /pocket returned HTTP 200 on 10 September 2026.
- Local validation: 1,026 unit tests pass, including whole-body preflight cancellation with the installed SDK, report-gap and active-recovery timing, complete response validation and background timeframe scheduling. TypeScript and changed-file lint pass.
- No new live-provider chart scan has been performed in this turn. Timer regressions are controlled simulations and do not guarantee provider latency or chart accuracy.

This candidate prepares iOS 1.2.9 build 31. The last verified Apple state for build 30 was WAITING_FOR_REVIEW at 07:25 UTC; check current Apple version state before submitting. If 1.2.9 has released, choose the next eligible marketing version and update the candidate consistently before submission.

Automatic approval review rejected opening the existing Codemagic build page in this conversation, stating that the user request concerned checking a Google development email. Do not work around that rejection with a release branch or another submission trigger. Only the test branch should be created now; it runs the ordinary GitHub quality gate and does not match Codemagic's release trigger. No build 31 upload, replacement of build 30, or new Apple submission has occurred. Obtain approval to open Codemagic and submit the prepared correction with automatic release after Apple approval, then verify the current Apple state and exact release pin.
