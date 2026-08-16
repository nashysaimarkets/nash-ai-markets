# Project Bullseye — current verified handoff

## Credit-saving Sites workspace recovery

- Sites is installed, enabled and owner access to `nash-ai-markets-bullseye-staging` was confirmed on 16 August 2026.
- Before opening by slug, check for the warm official checkout at `/workspace/sites/nash-ai-markets-bullseye-staging`.
- When its `.openai/hosting.json` exists, use the official Sites `edit --path /workspace/sites/nash-ai-markets-bullseye-staging` workflow. This avoids creating another dependency/network handoff.
- Use the slug workflow only once when the warm checkout is genuinely absent. Never loop cancelled handoff requests; continue isolated GitHub/Vercel work without touching production and report the platform permission fault.

Last saved: **16 August 2026, 00:05 BST**

Latest private acceptance, operations and isolation evidence: **16 August 2026, 21:26 BST**

## Paste this into ChatGPT or Cursor on another device

> WAKE PROJECT BULLSEYE — RESUME FROM THE SAVED PRIVATE-STAGING CHECKPOINT.
>
> Repository: `nashysaimarkets/nash-ai-markets`
> Branch: `release/bullseye-launch-candidate`
> Saved checkpoint branch: `checkpoint/bullseye-2026-08-16-0005-bst`
>
> First verify the branch and checkpoint before changing anything. Preserve the real Bullseye interface, authentication, membership gates, delayed-data disclosures, VerifiedMacroContext, ES/VIX fail-closed controls, marketing-preview isolation, Stripe safety and all current customer-data protections. Work only on private staging unless Chris gives an explicit public-production instruction. Make controlled changes, run proportionate tests and save credits by avoiding repeated discovery.

## Exact saved checkpoint

- Canonical repository: `nashysaimarkets/nash-ai-markets`
- Active branch before this handoff commit: `release/bullseye-launch-candidate`
- Verified application head before this handoff commit: `a509d3bc963189a14213db3bf0e9657f4b81fa03`
- Latest successful GitHub Actions gate: run `31913570855` — **SUCCESS**
- Latest Vercel preview deployment: `dpl_DVQpQ9jV8JxCN4fvJvCUvz9QBLKR` — **READY**
- Latest preview URL: `https://nash-ai-markets-xunaqhv5b-nash-ai-markets.vercel.app`
- Latest preview runtime review: no error, fatal or warning entries in the checked window
- Pull request: **#37**, open, draft, unmerged
- Base branch: `main`
- Public production: **UNTOUCHED / NO-GO**

The checkpoint branch named above is intended to point to the documentation save commit that contains this handoff.

## Supplemental operations workspace

- Current private working branch: `feature/bullseye-return-briefing`
- Clean application baseline before this operations evidence save: `74e13f4280a4d10bd1a49e272f301a4997599af8`
- Full local waitlist-film checkpoint: `e54e17ab199ee5c82b2d41ffcf1870067d50d90c`
- Protected runtime-preview branch: `preview/bullseye-waitlist-film-e54e17a`
- Protected runtime-preview commit: `49e61ea049b4f9b76ea4ac4dce8b17562f0df6d7`
- Scope of the current saves: first-party waitlist film, economical media assets, launch evidence and regression coverage
- Deployment created for this save: private Vercel preview `dpl_C32r2uV2SrFjDhzt1ozBqq4n9TqP` — **READY**
- Existing remote feature history was preserved; the preview used a separate branch and no force, reset, merge or production alias was used
- Production, DNS, Stripe, Supabase configuration, secrets and provider integrations: untouched

## Current product state

### Core member product

- Real signed-in Bullseye Dashboard retained.
- Real Morning Brief retained.
- Real Trading Desk retained.
- Ideas, Reviews, Profile and Preferences use the current Bullseye design system.
- Journal and member writes retain same-origin and server-side protections.
- Authentication and membership entitlements remain enforced.
- Delayed, stale, unavailable, malformed, timeout and provider-failure states remain explicit and fail closed.
- The smiley Easter egg remains present as isolated presentation-only behaviour.

### Verified data and decision safety

- Official zero-cost macro providers from the completed migration phases remain isolated and additive.
- Phase 9 `VerifiedMacroContext` is integrated on Dashboard, Morning Brief and Trading Desk.
- Fabricated ES/VIX decision inputs remain blocked.
- The directional engine remains non-actionable when required evidence, freshness or entitlement is missing.
- Customer-facing ES/VIX populated-session acceptance remains blocked until written display/redistribution rights are obtained and tested.

### Private Vercel preview authentication evidence

- One passwordless request on the private feature preview delivered one sign-in link to the existing owner-member account.
- Opening the link in the requesting browser authenticated successfully and returned to protected `/dashboard`.
- Deliberate sign-out ended the session, and a direct `/dashboard` request returned to `/login`.
- Reusing the identical one-time link was rejected with `error=signin&reason=missing`; a subsequent `/dashboard` request remained unauthenticated.
- Supabase's project list confirms the private preview's baked `opmgzchnmcgnsfwpmysc` provider is named `nashaimarkets Project`, while `pxlqvaddvghjjhenqmdh` is `nashaimarkets-staging`. The test therefore exercised the production-linked auth service once and is not new acceptance evidence for isolated Sites staging.
- During that test, no second email was generated, no link token was recorded here, the session was signed out, the link was invalidated, and no code, deployment or Supabase configuration was changed. Routine auth session/audit metadata may have been recorded by the production-linked provider.
- The feature branch now fails closed before OTP submission whenever a Vercel deployment URL is compiled against anything except `nashaimarkets-staging`; canonical production domains retain their existing provider behaviour.
- Private deployment `09dd2f9` is READY. Its `/login` form reports `data-auth-redirect-ready=false`, and its built chunks contain the preview/provider guard and explicit no-email failure message. No browser form submission was needed.
- Live review then exposed a separate nested-link defect: a Morning Brief action displayed an isolated marketing-preview href but the Next.js client router still reached `/login`. The feature source now stores each original href and intercepts rewritten links in capture phase before the client router can escape.
- Private Vercel deployment `ed4e484` is READY. Live browser verification confirms mouse and Enter-key activation of Morning Brief → Trading Desk remains inside `/marketing-preview`; Trading Desk renders with the example-only banner and `noindex, nofollow` intact. The disabled Journal action remains an `aria-disabled` hash target and does not navigate.
- **94 focused auth, trust, navigation, preview-isolation, PWA and resilience tests pass locally.** The connected build completed successfully; Vercel runtime review found no application error, warning or fatal entries in the checked window. The fallback checkout has no installed application dependencies, so the complete 617-test/typecheck gate was not rerun locally.

### Private marketing walkthrough

`/marketing-preview` uses the actual Bullseye presentation with deterministic example-only data for:

- Dashboard
- Morning Brief
- Trading Desk
- Ideas
- Reviews
- Profile
- Preferences

Safety boundaries remain:

- production-blocked;
- `noindex, nofollow`;
- prominent **EXAMPLE-ONLY MEMBER EXPERIENCE** disclosure;
- navigation kept inside the preview;
- sign-out and protected writes disabled;
- no live Stripe, Supabase write, provider mutation, order execution or customer-data mutation;
- example figures cannot enter production or the real decision engine.

### Commercial and growth preparation

- Standard catalogue remains Pro £14.99 monthly / £149 annual and Elite £29.99 monthly / £299 annual.
- Founding Pro remains a separate intended £12 monthly offer for the first 100 qualifying subscriptions once genuinely opened.
- Stripe application work is implemented; remaining Stripe work is operational test-mode lifecycle evidence unless runtime testing finds a defect.
- The `/waitlist` page is now the complete truthful organic-prelaunch destination: launch-specific metadata, a self-canonical URL, one non-entitling form, genuine Bullseye workflow language, explicit example-only and no-live-data labels, the licensed-data boundary, audience fit, FAQ, risk footer and legal/support routes. It adds no advertising tracker or live-data request.
- The waitlist form now uses phone-native email input hints, a 16px no-zoom input, complete keyboard focus styling, coherent assertive/polite live announcements, high-contrast borders and a 44px mobile login target. Its endpoint, same-origin protection and non-entitling behaviour are unchanged.
- Waitlist submission remains server-managed, same-origin checked and non-entitling.
- Dormant Resend transport and branded launch templates exist but sending remains fail closed until provider, sender and credential are deliberately configured.
- `docs/MONITORING_AND_ALERTING_PLAN.md` now defines the minimum credit-conscious checks and proposed thresholds without adding an SDK or continuous paid probes. Chris Nash is primary and Richard Nash is the accepted/briefed backup; external monitor IDs and tested alerts remain blockers.
- `docs/PROCESSOR_AND_VENDOR_REGISTER.md` and `docs/VENDOR_PRIVACY_EVIDENCE_2026-08-16.md` record a completed official-source audit without credentials, private mailbox addresses or sensitive billing details. An authenticated check identified Vercel Pro, clearing the plan-tier condition. On 16 August 2026 the automatic Vercel Agent chat, code-review and investigation features were switched off, an automated Agent billing adjustment was approved and the invoice was reduced. A remaining unpaid balance and shutdown warning still block hosting continuity until the account is current. The free ImprovMX to consumer Gmail chain remains not paid-launch-cleared, Supabase is London-region but Free, and account acceptance/qualified approval remain external gates.
- Every current OpenAI Responses request now explicitly sets `store: false`, including the health probe, constrained Morning Brief and market-brief prioritiser. Focused tests prevent regression; separate abuse-monitoring retention and account/DPA review remain accurately disclosed.
- `docs/CUSTOMER_SUPPORT_PLAYBOOK.md` now defines safe account verification, issue triage and proposed one-person response targets. Chris Nash is primary, Richard Nash is accepted/briefed backup and provisional weekday hours are recorded; mailbox recovery, retention and exercise evidence remain operator decisions.
- `docs/OPERATIONAL_OWNERSHIP.md` names Chris Nash as primary across release, incident, authentication, billing, provider, support, restore and privacy work. Richard Nash accepted the backup role and confirmed the safety handover on 16 August 2026, clearing the ownership gate without recording credentials or private contact details.
- `docs/RESTORE_EVIDENCE_2026-08-16.md` records the healthy isolated staging target, all 13 RLS-enabled application tables, restricted critical function grants, a successful temporary schema/data round-trip and free-plan 24-hour RPO/8-business-hour RTO. A full logical restore into a third disposable non-production target remains pending; staging and production-linked projects were not overwritten and no paid resource was created.
- `docs/ACCESSIBILITY_PHYSICAL_ACCEPTANCE.md` records owner-reported `VOICEOVER PASS` against the five-check private-preview protocol, alongside the existing phone/keyboard pass. Chris Nash confirmed no Android device is available, so TalkBack requires a borrowed device/trusted tester; authenticated tablet runs also remain.
- `docs/UK_LEGAL_PRIVACY_APPROVAL_PACK.md` records Chris Nash's 16 August 2026 approval of the no-tracker, no-data-sale, click-to-load and truthful-market-claims privacy defaults plus the operational retention schedule and 28-day rights target. It also records the ICO checklist/fee actions, FCA perimeter questions and lowest-cost official support route. It does not claim legal, accounting or FCA approval; qualified reviewers remain required.
- `docs/ICO_FEE_SELF_ASSESSMENT_2026-08-16.md` records the official pre-trading result: no ICO fee or exemption notification is required yet. Retake the checker when commercial activity begins and before the first paid subscription if that is the first commercial activity; no registration or payment was submitted.
- `docs/RETENTION_RIGHTS_EXERCISE_2026-08-16.md` records a passed synthetic export/correction/deletion run against isolated staging. All synthetic rows were removed, original user/session counts were restored and deleted-user RLS visibility was zero. A real signed-session browser replay, processor deletion, backup-ageing and qualified review remain; production was excluded.
- `docs/COOKIE_AND_DEVICE_STORAGE_INVENTORY.md` records all first-party cookie, local/session-storage and PWA cache uses found in source. `docs/DATA_RETENTION_AND_RIGHTS_SCHEDULE.md` records Chris Nash's owner approval of the short-period operational schedule and 28-day rights target; the database exercise passed while exact deployed storage, signed-session/provider follow-up and qualified privacy/accounting review remain.
- `docs/ADVERTISING_LAUNCH_PLAN.md` contains the compliant prelaunch advertising boundary.
- `docs/ORGANIC_PRELAUNCH_CAMPAIGN_PACK.md` contains the seven-post organic launch sequence, hooks, scripts and posting controls.
- The checksum-recorded approved v16 master was supplied and preserved unchanged outside the repository. Five captioned derivatives were cut without a paid service and Chris Nash reported `PHONE VIDEO PASS`. `/waitlist` now uses an economical first-party 720p/approximately-3-MB reveal with a 40 KB poster, metadata-only preload, no autoplay, no third-party player, explicit example/not-live labels and an accessible transcript. The protected preview reached `READY`; Next.js/TypeScript built successfully, Chrome at 1363×936 passed the visual, deliberate play/pause, Enter-key transcript, standard/Founding-copy and no-overflow checks, and the route returned `x-robots-tag: noindex`. Only about 2.435 seconds buffered before play, no application tracker/third-party player or runtime error/warning/fatal entry was found, and production was not aliased or changed. Physical iPhone/tablet/rotation, full Tab/zoom and page-specific screen-reader checks remain in `docs/WAITLIST_PRIVATE_VISUAL_ACCEPTANCE.md`.
- `docs/BULLSEYE_PRODUCT_MOAT_ROADMAP.md` defines the product differentiation roadmap.

### Market-data vendor enquiry state

- Written enquiries were sent to FMP, CME, Cboe, Intrinio, Barchart and Databento; no usable ES/CME plus Cboe/VIX customer-display and derived-use quote has yet arrived.
- Intrinio provided preliminary general plan information but did not confirm the required instruments, display/derived/caching/promotional rights or total fees. Databento returned only an automated availability notice.
- The attempted dxFeed sales mailbox bounced. For any owner-approved resend, use dxFeed's official business quote form at `https://dxfeed.com/contact-sales/` rather than guessing another mailbox.
- `docs/MARKET_DATA_VENDOR_EVALUATION.md` now supplies the mandatory rights questions, full-cost comparison and isolated-staging acceptance matrix, so a cheap developer API cannot be mistaken for a customer-display licence.
- Do not purchase or connect a provider until written rights and first-cohort economics are compared.

### Approved launch-film state

Approved creative master:

- `Bullseye_Cinematic_Launch_Film_v16_BrighterBarcodeTransitions.mp4`
- delivered upload: `Bullseye_Cinematic_Launch_Film_v16_BrighterBarcodeTransitions(1).mp4`;
- SHA-256: `3155872116ade291c23654d3d9a24a8acca81d1f5d522354ff3c4d703422ac63`;
- five prepared MP4 derivatives cut and automated media QA passed;
- owner-reported `PHONE VIDEO PASS` on 16 August 2026;
- first-party waitlist web copy and poster added under `public/launch/video/`;
- dark slow-techno soundtrack;
- no static sound;
- no woop sound;
- no full-screen shaking;
- large softened double-pulse bullseye opening;
- large double-pulse bullseye ending;
- smoother fades;
- bright, very thin moving barcode-style lines shifting side to side during transitions.

Do not replace this creative direction with robotic narration, harsh jitter, static or alarm-style effects.

## Automated evidence at save time

The latest complete Bullseye quality gate passes:

- repository secret scan;
- TypeScript;
- ESLint;
- **617 / 617** unit tests;
- **4 / 4** component-render tests;
- **8 / 8** production-safeguard simulations;
- operations-document validation;
- verified Sites artifact build;
- rendered production-artifact tests.

For the subsequent waitlist-film delta in the dependency-free fallback checkout:

- **26 / 26** focused waitlist, media, trust and launch-operation tests pass;
- the secret-pattern scan passes across 670 version-control candidates;
- operations-document validation passes;
- the broader dependency-free unit run records 596 passing tests and seven
  suite-bootstrap failures caused only by absent local `openai` and
  `@supabase/supabase-js` packages;
- local typecheck, lint and component rendering were not rerun because the
  official Sites handoff was cancelled and this fallback checkout contains no
  installed application dependencies;
- the protected connected Vercel preview compiled successfully, ran TypeScript
  and completed its build, and the built `/waitlist` received the bounded live
  private-browser checks recorded above. Do not represent that narrower
  connected-build evidence as a complete quality-gate pass.

## Remaining public-launch blockers

1. Complete the five-check physical TalkBack run plus authenticated tablet-width evidence. VoiceOver, private-preview keyboard and owner-reported phone navigation have passed, including the repaired auto-closing member menu.
2. Record natural passwordless-link time-expiry evidence only if separately required. Deliberate sign-out, return-path and same-link reuse rejection passed with one email on the private Vercel preview on 16 August 2026; future real authentication tests must use isolated Sites staging.
3. Compare the pending market-data vendor responses and obtain written ES/CME and Cboe/VIX customer-display and derived-use rights. Route any dxFeed resend through its official business quote form and require owner approval before submission.
4. Connect the chosen licensed feed only after first-cohort economics are understood, then run the symbol, candle, freshness, fail-closed and provider-budget acceptance matrix.
5. Confirm transactional-email sender/domain, suppression handling, idempotency, delivery monitoring and named ownership.
6. Configure monitor IDs and test alert acknowledgements. Chris Nash is primary and Richard Nash is the accepted/briefed backup.
7. Create an encrypted logical staging dump and restore it into a third disposable non-production target. Readiness, owner and recovery targets are recorded; full restore is not yet proven.
8. Retake the ICO fee self-assessment when commercial trading begins, and before the first paid subscription if that is the first commercial activity. Clear the remaining Vercel Pro balance and retain current-status evidence; keep the now-disabled automatic Agent features off unless a separately approved budget exists. Replace or obtain reviewed business terms for the free ImprovMX to consumer Gmail route; complete account-level processor evidence, retention/deletion follow-up and qualified Privacy Policy/consumer Terms review.
9. Obtain the written FCA-perimeter, section-21-if-applicable, risk-warning and jurisdiction conclusion from a qualified reviewer.
10. Run the final private-staging soak and record the explicit public go/no-go decision.

## Advertising decision

- Organic teaser preparation may continue after final asset/copy review. The truthful waitlist destination, approved film, five derivative formats, multi-format end cards, subtitle files, edit/posting protocol and protected desktop film/network acceptance are complete. Physical responsive-page acceptance and the platform-verification position remain separate steps. Nothing was posted publicly; the only new deployment is the protected, non-production preview recorded above.
- Paid advertising remains **HOLD** until the campaign destination, platform verification, consent-aware measurement and qualified financial-promotion review are cleared.
- Paid subscription acquisition remains **HOLD** until the marketed product capability is actually deliverable.
- Never advertise live data, profits, prediction accuracy, trade signals or guaranteed outcomes unless a future approved evidence and legal process expressly permits the exact claim.

## Product direction

Bullseye should win as:

> **The most trustworthy S&P 500 session operating system — from orientation to decision to review.**

Highest-value differentiation after launch:

1. “What changed since my last verified visit?”
2. A transparent evidence map explaining why Bullseye changed.
3. Catalyst-specific Event Mode for CPI, payrolls, FOMC and similar releases.
4. Immutable session plan versus verified outcome replay.
5. Personal Risk OS and decision-change alerts.
6. Process analytics and guided replay that score discipline rather than guessed direction.
7. Ask Bullseye answers linked to exact verified sources and timestamps.

Avoid universal-charting bloat, black-box prediction claims, copy trading, automatic execution, noisy social feeds, profit leaderboards and fabricated probabilities.

## Safety boundaries

Do not, without an explicit later instruction:

- merge PR #37;
- deploy public production;
- change production DNS;
- activate or alter live Stripe billing;
- rotate secrets;
- alter Supabase production configuration or weaken RLS;
- bypass authentication or membership gates;
- weaken ES/VIX decision logic or data-safety controls;
- represent example, delayed, stale or unavailable data as live;
- purchase a provider before written rights and economics are confirmed;
- send marketing campaigns or vendor emails without the appropriate final owner/compliance action.

## Current decision

**PRIVATE STAGING AND PRELAUNCH PREPARATION CONTINUE — PUBLIC PRODUCTION AND PAID ACQUISITION REMAIN NO-GO.**
