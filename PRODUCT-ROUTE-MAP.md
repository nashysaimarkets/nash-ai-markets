# Product Route Map

Every live route, its purpose, intended access tier, primary action and data dependencies.
38 page routes and 16 API routes.

Access tier is derived from the route's own gate (`redirect("/login")`,
`resolveMembershipTier`, or `member-page-access`), not from navigation links.

**No route has been deleted or redirected.** Consolidation notes are recommendations.

---

## Public — acquisition and legal

| Route | Purpose | Primary action | Data dependencies | Status |
|---|---|---|---|---|
| `/` | Homepage | Start free / see pricing | Static + ticker copy | Live |
| `/pricing` | Plan comparison | Start checkout | Stripe price IDs | Live |
| `/about` | Company and method | Read | Static | Live |
| `/help` | Support and FAQ | Contact | Static | Live |
| `/contact` | Contact form | Submit | None | Live |
| `/waitlist` | Waitlist capture | Submit email | `POST /api/waitlist` | Live |
| `/welcome` | Post-signup landing | Continue to dashboard | Session | Live |
| `/login` | Sign in | Magic link | Supabase auth | Live |
| `/auth/callback` | Auth return | Automatic | Supabase auth | Live |
| `/auth/implicit` | Implicit-flow return | Automatic | Supabase auth | Live |
| `/cancelled` | Checkout cancelled | Retry | Stripe redirect | Live |
| `/membership-required` | Access explainer | Upgrade | Membership tier | Live |
| `/privacy` | Privacy policy | Read | Static | Live — legal, protected |
| `/terms` | Terms | Read | Static | Live — legal, protected |
| `/risk-disclaimer` | Risk disclosure | Read | Static | Live — legal, protected |

## Public — developer surfaces

| Route | Purpose | Status | Recommendation |
|---|---|---|---|
| `/dev/logo-concepts` | Brand exploration | Live, publicly reachable | **Review.** Internal design scratchpad on a customer domain. Gate or remove. |
| `/dev/terminal-chart` | Chart harness | Live, publicly reachable | **Review.** Same. |

These two are the only unauthenticated non-product pages. They expose no data, but they are
reachable and unfinished, which undercuts the premium impression if a customer finds them.

---

## Member — daily loop

| Route | Purpose | Tier | Primary action | Data dependencies | Status |
|---|---|---|---|---|---|
| `/dashboard` | **Command Centre** — the daily landing surface | Free+ (depth gated) | Read posture, open chart | Verified market context, candles, decision engine, oracle bundle, video manifest | Live — primary |
| `/brief` | Morning Brief | Free+ (depth gated) | Prepare before the open | Market brief, economic calendar, AI selection | Live |
| `/terminal` | Trading Desk | Pro/Elite | Monitor the session | Candles, catalyst radar, decision engine | Live |
| `/reviews` | Published market reviews | Free+ | Watch or read | Video manifest | Live — empty until a video is published |
| `/journal` | Risk and trade journal | Free+ | Record a trade | `member_trade_journal` (capped at 200) | Live |
| `/onboarding` | First-run setup | All | Complete setup | `member_onboarding` | Live — gates `/dashboard` |
| `/preferences` | Member preferences | All | Save preferences | `POST /api/onboarding` | Live |
| `/profile` | Account and membership | All | Manage billing | Membership, Stripe portal | Live |
| `/ideas`, `/ideas/[id]` | Feature voting | Free+ | Vote, comment | `member_monthly_votes`, ideas tables | Live |
| `/founding-member` | Founding-100 status | Founding | View benefits | Membership | Live |

## Member — secondary workspace

These are reachable by direct link but deliberately absent from primary navigation
(`unfinishedWorkspaceLinks` in `MemberShell`). That is an honest choice, but it means seven
routes exist that a customer can land on without a way back into the main product.

| Route | Purpose | Status | Recommendation |
|---|---|---|---|
| `/review` | Session review | Partial | **Merge** into `/reviews`. Two near-identical names is a navigation trap. |
| `/replay` | Session replay | Partial | **Merge** into `/dashboard#session-replay`, which already renders the replay panel. |
| `/archive`, `/archive/[date]` | Historical briefs | Partial | Keep; promote once populated. |
| `/performance` | Performance history | Partial | Keep dormant. Do not surface until the data is verified — performance claims carry the highest trust cost. |
| `/results` | Results summary | Partial | **Merge** with `/performance`. |
| `/methodology` | How the engine works | Complete | **Promote.** This is trust-building content currently hidden from navigation. |

`/review` vs `/reviews` and `/results` vs `/performance` are the two clearest
consolidation opportunities in the product.

## Member — admin and diagnostics

| Route | Purpose | Gate | Status |
|---|---|---|---|
| `/admin/commercial` | Commercial metrics | Founding-100 admin | Live |
| `/admin/founding-100` | Founding cohort admin | Founding-100 admin | Live |
| `/terminal/diagnostics` | Provider diagnostics | Member | Live — shows variable *names* and present/missing booleans only, never values |

---

## API routes

| Route | Method | Purpose | Auth | Notes |
|---|---|---|---|---|
| `/api/market/candles` | GET | Verified candle series | Session + Pro/Elite | Returns 503 when membership lookup is degraded, 403 only for genuine tier failure |
| `/api/stripe/checkout` | POST | Start checkout | Session | Protected — do not modify |
| `/api/stripe/portal` | POST | Billing portal | Session | Protected — do not modify |
| `/api/stripe/webhook` | POST | Subscription state | Stripe signature | Protected — signature verified before parsing |
| `/api/membership/preview` | POST | Preview claims | Session | Same-origin enforced |
| `/api/founding-member` | POST | Founding enrolment | Session | Same-origin enforced |
| `/api/onboarding` | POST | Save onboarding | Session | Same-origin enforced |
| `/api/profile` | POST | Update profile | Session | Same-origin enforced |
| `/api/journal` | POST | Journal entry | Session | Same-origin enforced |
| `/api/ideas` | GET/POST | Ideas list and create | Session | Same-origin enforced |
| `/api/ideas/[id]` | POST | Vote, unvote, comment | Session | UUID-validated; 400/409/503 distinguished |
| `/api/waitlist` | POST | Waitlist signup | Public | Same-origin enforced |
| `/api/openai/health` | GET | AI provider health | Session | No key material returned |
| `/api/youtube/oauth/callback` | GET | YouTube OAuth return | Operator | Media pipeline, currently unconfigured |
| `/api/auth/supabase-config-probe` | GET | Config probe | **404 in production**, else founding admin | Gated during the previous audit |
| `/api/auth/redirect-probe` | GET | Redirect probe | **404 in production**, else founding admin | Gated during the previous audit |

---

## Summary of recommendations

1. **Gate or remove** `/dev/logo-concepts` and `/dev/terminal-chart` — the only
   unauthenticated unfinished pages on the customer domain.
2. **Merge** `/review` into `/reviews`, `/replay` into the dashboard replay anchor, and
   `/results` into `/performance`. Four routes become two, and two confusing name pairs
   disappear.
3. **Promote** `/methodology` into member navigation. It answers "can I trust this?", which
   is the question a new subscriber asks first, and it is currently unreachable by clicking.
4. **Leave** `/performance` hidden until its numbers are verified.

No code deletions are implied by any of the above. Route consolidation should be done as a
redirect first, with the old route retained until traffic confirms nothing is lost.
