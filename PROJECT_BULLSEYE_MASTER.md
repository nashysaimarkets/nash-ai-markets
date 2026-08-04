# PROJECT BULLSEYE — MASTER SOURCE OF TRUTH

Last updated: **4 August 2026**  
Repository path: `/Users/nashys/Desktop/nash-ai-markets-live`  
GitHub: `nashysaimarkets/nash-ai-markets`  
Status at write: branch `release/bullseye-launch-candidate` @ `2ae234d`  
**Public production: NO-GO.** Private staging continues.

This file is the recovery brief for humans and future AI sessions. Prefer it over chat memory. Cross-check live evidence in `docs/LAUNCH_GATE_STATUS.md` and the current git tip before acting.

---

## 1. Architecture

Project Bullseye is a Next-compatible React app (Vinext → Cloudflare Worker-style Sites artifact).

```text
Browser
  ├─ public marketing / pricing / waitlist / legal
  ├─ Supabase passwordless magic-link auth
  └─ authenticated member surfaces
       ├─ Supabase: session, membership, ideas, journal, prefs
       ├─ Market gateway → FMP (or preview/unavailable) → fail-closed snapshots
       ├─ Deterministic intelligence / decision / planner engines
       └─ Entitlement-filtered UI (Free / Pro / Elite)

Stripe Checkout / Customer Portal
  └─ signed webhook → membership upsert (server-only)
```

**Does not:** place trades, invent market data, send live daily email briefs by default, or treat unavailable feeds as live.

Deeper detail: `docs/ARCHITECTURE.md`, `PRODUCT-ROUTE-MAP.md`, `PRODUCT-COMPONENT-DECISIONS.md`.

### Primary customer routes

| Route | Role |
|---|---|
| `/` `/pricing` `/login` | Acquisition and access |
| `/dashboard` | Daily command centre |
| `/brief` | Morning Brief |
| `/terminal` | Trading Desk |
| `/ideas` `/journal` `/reviews` | Learning / review workflow |
| `/profile` `/preferences` | Account and workspace |
| `/auth/callback` | Magic-link return |

Unfinished workspace destinations (e.g. `/performance`) may exist as deep-links but must not be re-advertised as finished nav (“More” / “Present” stay hidden).

---

## 2. Branch strategy

| Branch / ref | Role |
|---|---|
| `main` (GitHub) | Production lineage tip — currently `0d0cde5` (includes PR #35). Do not treat local `main` as fresh. |
| `feature/morning-brief-premium-ux` | PR #36 — Preferences, Brief polish, Ideas fail-closed, hide More/Present |
| `release/bullseye-launch-candidate` | **Active launch-candidate worktree** — PR #36 lineage + staging recovery + commercial hardening |
| `sites/staging-dashboard` / `backup/pre-launch-staging-2026-08-03` | Historical private-staging audit tip `df5bb0d` (unrelated root; keep as backup) |
| `checkpoint/bullseye-*` | Local recovery checkpoints — do not delete casually |

**Rules**

1. Prefer small commits on `release/bullseye-launch-candidate`.
2. Never force-reset shared branches without owner approval.
3. Do not merge to `main` / deploy production without an explicit go.
4. Leave PR #36 open until the launch-candidate PR on GitHub is proven to supersede it.

---

## 3. Deployment flow

```text
Local develop / private staging Sites build
        ↓
Push feature or release/* branch
        ↓
GitHub PR → Vercel Preview (non-production)
        ↓
Owner staging acceptance (Sites private host)
        ↓
Explicit go only → production deploy (NOT authorized yet)
```

- Local start: `npm run build` then `npm run start` (or project-standard Sites tooling).
- Visual inspection: `npm run visual-review` (requires healthy assets + optional auth storage state).
- Auth-free layout preview: `npm run preview:member` / `npm run preview:shots`.

---

## 4. Production vs staging

| Concern | Staging | Production |
|---|---|---|
| Purpose | Owner-only release acceptance | Public members |
| Sites origin (coded) | `https://nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site` | `https://www.nashaimarkets.com` / `https://nashaimarkets.com` |
| Decision | Continue private staging | **NO-GO** until launch gates clear |
| Stripe | Test mode only | Live only after approval |
| Data claims | Delayed / unavailable honest | Same fail-closed rules |

Source: `app/lib/auth/safe-auth-redirect.ts`, `docs/LAUNCH_GATE_STATUS.md`, `docs/PROJECT_BULLSEYE_HANDOFF.md`.

---

## 5. Supabase environments — INCLUDING OPEN DISCREPANCY

### What the repository asserts (code + docs + tests)

| Source | Staging Supabase project ref |
|---|---|
| `STAGING_SUPABASE_PROJECT` in `app/lib/auth/safe-auth-redirect.ts` | **`pxlqvaddvghjjhenqmdh`** |
| `docs/LAUNCH_GATE_STATUS.md` | **`pxlqvaddvghjjhenqmdh`** |
| `tests/auth-redirect.test.ts` | **`pxlqvaddvghjjhenqmdh`** returns **compatible** on Sites staging origin |

The same test treats **`https://opmgzchnmcgnsfwpmysc.supabase.co` as incompatible** when the request origin is the owner-only Sites staging host (fail-closed on provider mismatch — introduced in `f00fca8`).

Compatibility check applies **only** when the browser origin is the Sites staging origin. Localhost skips that check.

### What this workstation’s local `.env` currently points at (host only)

| Item | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` host | `opmgzchnmcgnsfwpmysc.supabase.co` |
| Project ref | **`opmgzchnmcgnsfwpmysc`** |

No secret values are recorded here.

### Discrepancy (UNRESOLVED — do not silently “fix”)

- **Documented / coded Sites staging provider:** `pxlqvaddvghjjhenqmdh`
- **Local `.env` provider:** `opmgzchnmcgnsfwpmysc`
- **Repo evidence for `opmgz…` as production:** none found
- **Repo evidence for `opmgz…` as staging:** none found — only used as the **negative** fixture in auth tests
- **Vercel / hosting env files in git:** no committed Supabase URL binding for either ref (`.openai/hosting.json` is OpenAI project metadata, not Supabase)
- **Owner confirmation:** not yet established which cloud project local keys belong to

**Implication:** a developer can run localhost against `opmgz…` without tripping the Sites fail-closed guard, while the private Sites host expects a browser/build bundle compiled for `pxlqv…`. Do **not** change `.env`, launch-gate docs, or auth constants until the owner confirms identity of both projects in the Supabase dashboard.

### Safest resolution path (awaiting approval)

1. Owner opens Supabase dashboard and labels which ref is staging vs production vs obsolete.  
2. Align local `.env` for **local** work intentionally (document purpose).  
3. Align Sites build/runtime env so Sites host + `STAGING_SUPABASE_PROJECT` match.  
4. Only then update `docs/LAUNCH_GATE_STATUS.md` if the coded staging ref must change (high risk — needs explicit approval).

---

## 6. Stripe architecture

- Prices selected server-side from env Price IDs; secrets never returned to the browser.
- Webhook signature verification required; membership upsert is server-only.
- Founding Pro uses a dedicated Price ID and eligibility checks (see recent local commits / `docs/ENVIRONMENT_VARIABLES.md`).
- Staging/test matrix: `docs/STRIPE_STAGING_TEST_MATRIX.md`.
- **Launch gate:** Stripe test-mode lifecycle not fully configured for public launch.
- Untracked local: `infra/stripe-webhook-relay/` — treat as experimental until reviewed; do not push blindly.

---

## 7. Completed features (high confidence)

- Public site, login, pricing, membership gates  
- Dashboard / Morning Brief / Trading Desk with fail-closed market states  
- Preferences route + Profile links; Ideas hub loading/error/empty  
- Hide unfinished More / Present navigation  
- Companion / oracle / command-centre layers (PR #36 lineage)  
- Learning rail (Ideas → Journal → Reviews) on launch-candidate tip  
- Owner-only private Sites staging auth origin allowlist  
- Staging provider mismatch fail-closed for Sites host  
- OpenAI brief deterministic fallback paths (repository tests)  
- Draft PR #37 lineage from PR #36 tip `b8bd37a` (GitHub tip may lag local)

---

## 8. Remaining features / hardening

- Authenticated tablet/mobile + a11y matrix evidence  
- Auth link expiry / reuse / sign-out return-path matrix  
- Populated delayed candle session acceptance (blocked on deliberate FMP entitlement)  
- Stripe test-mode full lifecycle proof  
- Transactional email provider readiness  
- Monitoring, backup/restore drill, legal / financial-promotion approvals  
- Founding Pro waitlist/offer work present locally — confirm product readiness before publishing  
- Push / reconcile 52-ahead local tip with GitHub PR #37  

---

## 9. Launch blockers

See `docs/LAUNCH_GATE_STATUS.md` (evidence review 2 Aug 2026). Headline:

1. Auth / mobile / tablet staging evidence incomplete  
2. FMP entitlement for populated session  
3. Stripe test-mode acceptance  
4. Email delivery readiness  
5. Ops + legal + promo approvals  
6. Production DNS/secrets/deploy not authorized  
7. **Operational:** local tip `2ae234d` is **52 commits ahead** of `origin/release/bullseye-launch-candidate` (`b8bd37a`) — GitHub PR is not “latest local”

---

## 10. Known bugs / risks

| Risk | Notes |
|---|---|
| Supabase env ambiguity | Local `opmgz…` vs coded Sites staging `pxlqv…` — unresolved |
| Stale GitHub launch PR tip | PR #37 @ `b8bd37a`; local @ `2ae234d` |
| Visual review incomplete | Last pack INCOMPLETE without auth storage state |
| Untracked `infra/` | Not in version control |
| Local `main` stale | Do not use as upstream truth |

---

## 11. Deployment checklist (abbreviated)

**Never production without owner go.**

Staging:

1. Confirm Sites hostname + Supabase project ref match (`pxlqv…` until owner redirects).  
2. Staging Site URL + exact `/auth/callback`.  
3. Stripe **test** keys/prices/webhook only.  
4. Build Sites artifact; smoke Dashboard / Brief / Desk / login.  
5. Record version and checkpoint tag.

Production (blocked):

1. All launch-gate rows cleared.  
2. Immutable artifact + rollback owner named.  
3. Explicit written go.

Use also: `docs/STAGING_DEPLOYMENT_CHECKLIST.md`, `docs/DEPLOYMENT_CHECKLIST.md`.

---

## 12. Rollback procedure

| Situation | Action |
|---|---|
| Bad local experiment | `git switch -C rescue/… HEAD` then reset carefully only with approval |
| Need last verified staging app tip | `checkpoint/bullseye-staging-v35-2026-08-03` / handoff doc (~`141490c` era) |
| Need 2 Aug audit tip | `backup/pre-launch-staging-2026-08-03` / `sites/staging-dashboard` @ `df5bb0d` |
| Need GitHub PR #37 tip | `origin/release/bullseye-launch-candidate` @ `b8bd37a` |
| Production incident | Do not “hot fix” from staging blindly; roll back the authorized immutable artifact |

Never `push --force` to `main`. Never delete remote backup tags/branches without approval.

---

## 13. Recovery instructions for future AI sessions

1. Read **this file** and `docs/LAUNCH_GATE_STATUS.md`.  
2. `git status -sb` and `git log --oneline -15` — confirm branch tip.  
3. Do **not** deploy production, weaken auth, invent market data, or apply production migrations.  
4. Treat Supabase project identity as **unresolved** until owner labels `pxlqv…` and `opmgz…`.  
5. Prefer small commits; no push unless asked.  
6. Run proportionate tests after changes (`npm run test:unit`, targeted route tests, `npm run typecheck`).  
7. For UI review: `npm run visual-review` or `preview:shots` without bypassing auth.

Paste handoff starter:

> Continue Project Bullseye from `PROJECT_BULLSEYE_MASTER.md` in `/Users/nashys/Desktop/nash-ai-markets-live`. Branch `release/bullseye-launch-candidate`. Public production remains NO-GO. Do not resolve Supabase `pxlqv…` vs `opmgz…` by editing `.env` without owner confirmation.

---

## 14. Open PRs (snapshot)

| PR | Branch | Role |
|---|---|---|
| #37 (draft) | `release/bullseye-launch-candidate` | Launch candidate on GitHub |
| #36 (open) | `feature/morning-brief-premium-ux` | Morning Brief / Preferences / Ideas / nav safety |
| Older drafts | various | Historical — do not merge without reconciliation |

---

## 15. Milestone grouping of local +52 commits (vs `origin/release/bullseye-launch-candidate`)

See companion section in the Phase-2 action plan; summary:

1. **Staging source lineage** (`5b724b2`…`df5bb0d`) — private Sites staging foundation  
2. **UX polish & learning workflow** — Brief Pulse, desk, ideas/journal hardening  
3. **Auth restore & merge** — `bf5b6f9`…`156f666`  
4. **Product focus & handoff** — ES routing, Free vs paid candles, journal copy, Sites rebuild  
5. **Founding Pro commercial** — offer, waitlist, price eligibility  
6. **Billing hardening** — webhook serialize, cancellation schedule, cadence UI, staging host normalize  

**Caution before any push:** milestones 1/3/5/6 touch auth, Supabase migrations, and Stripe — review before publishing; keep `infra/` untracked until reviewed.
