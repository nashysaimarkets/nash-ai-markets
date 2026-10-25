# Build 52 candidate: single-action analysis and email return

Exact source: `2091e1ec4307b414df9f7635935f0d10e45ff3e9`; tree `320a6565550f8177c408f73265b402e0fbcb8218`.

Owner reported Build 51 still blocked. The native screenshot says NTP sign-in is required. Public Build 51 login HTML references existing provider opmgzchnmcgnsfwpmysc.supabase.co, while the generic preview policy only allows pxlqvaddvghjjhenqmdh.supabase.co. This mismatch is reproduced by a regression test. Owner confirmed email-link sign-in. The native Info.plist had no authentication URL scheme and no appUrlOpen email return handler existed.

## Implemented
- Removed ChartPreflightPanel from premium intake/results, manual fact corrections/retry, privacy checkbox and disabled-before-preflight Analyse gate. One Analyse action acquires automatic source facts then runs analysis. No network on chart selection. Fail closed on unreadable/uncertain evidence, mismatched provenance, auth failures, cancellation and stale responses. A genuinely unreadable image gets one actionable replace-image message.
- Removed redundant readiness box. Compact account state, quieter mobile intro, safe-area-aware header and viewport-fit cover. Original scanner mechanisms and prices preserved.
- Existing-email-only in-place native sign-in; random nonce + PKCE, exact custom scheme/host/path, expiry and one-use callback. Isolated nonpersistent client cannot write browser cookies on a late SDK return. Only guarded same-origin server session persistence completes login. Selected charts remain in memory. No password, new customer, repurchase or ownership rewrite.
- Explicit opt-in native release binding requires matching configured branch/provider/current immutable Vercel URL. Generic staging-preview guard remains intact. This configuration is enabled only for the owned candidate branch. Legacy email page supports the same scoped binding; web/Android retains its existing email-login route.
- Info.plist registers native callback scheme; existing SceneDelegateProxy forwards URL events. Existing signing reused, build number52 and exact backend/source Codemagic pins applied.

## Verification
179 targeted tests PASS. New tests also run with repository default Node loader:45 PASS. Actual React/CSS offline browser:20 PASS across390x844 and1440x1000; synthetic intercepted HTTP/Auth, zero real provider calls. Includes one-click report,401 recovery/image preservation, native email return, unreadable/503/cancel, stale unmounted exchange, five sources and no overflow. Screenshots contain labelled synthetic chart only.

Independent agent review:64 tests PASS, source/security PASS. Findings repaired: stale report retained after failed reanalysis, missing result-side account form, shared SDK session persistence before guard, missing non-native login route, and default Node import resolution. New parser tests cover duplicate/mismatched/expired/forged callback rejection.

TypeScript, changed-source ESLint, secret scan and git diff whitespace:PASS. Production Next webpack build passed using nonfunctional offline Supabase fixture values; no live provider inference. Final import-only compatibility change verified with default Node tests and TypeScript. React checklist reviewed: work starts from user event, cheap guards before asynchronous work, listener cleanup, accessible labels/status, no shared session mutation or new UI library.

## Hosted verification and internal delivery
Production email template and redirect allowlist inspected read-only. Existing preview wildcard permits HTTPS `/auth/native-return`; no production template, Site URL or redirect changes. The relay validates code/nonce, returns only a fixed native app URL, no cookies, strict CSP and no-referrer. Exact middleware bypass prevents shared authentication processing on this relay only. Independent review includes this addition.

Two nonsecret env bindings were created only for the owned preview branch. Immutable backend: https://nash-ai-markets-2u2c2wuqm-nash-ai-markets.vercel.app/pocket (Vercel dpl_5F2bWQ43Ux39d8gGEPNsjgv2VBvr). Exact source identity PASS; unsigned Apple-account endpoint401; synthetic relay200/no cookies/no-referrer. Build52 native run6ade222f4a72334e32e50a84 started against this exact source and backend; finished successfully in2m57s. Apple upload succeeded at2026-10-25T15:40:27Z; delivery UUID dd4e5fc7-bafc-4329-ad1e-2273f63fec2d. Apple processing completed; Build52 Ready to Submit and assigned to Pocket Bullseye Internal Testers,1invite. No external group/public submission. Signed receipt intentionally preserves its pre-publication uploaded:false flag; TESTFLIGHT52.json records subsequent upload.

Actual signed-device email return and existing subscriber Apple entitlement/restore remain UNVERIFIED. Do not infer restoration from login or synthetic tests; no repurchase. Main, production, pricing, customer records and schedules unchanged. Internal-only candidate; no public release. Rollback: retain previous internal build and discard this isolated branch.
