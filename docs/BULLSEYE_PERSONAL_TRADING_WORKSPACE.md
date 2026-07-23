# Project BULLSEYE — Personal Trading Workspace

Status: **in progress on branch `bullseye-personal-trading-workspace`** (draft PR; preview only).

## Goal

Signed-in members choose favourite markets, then land on a personal trading desk at `/terminal` with verified charts, market review, and a loadable widget system. First visit uses market selection; returning visits restore saved workspace preferences.

## Preserved systems (do not regress)

| System | Path / notes |
|---|---|
| Magic-link auth | `/login`, `/auth/callback` (path-only), `/auth/confirm`, middleware session refresh |
| Auth redirect allowlist | `app/lib/auth/safe-auth-redirect.ts` — default post-auth `/terminal` |
| Membership / Stripe | `memberships`, checkout, portal, webhook — unchanged |
| Market gateway | FMP + fail-closed snapshot / candle freshness |
| Candle validation | `/api/market/candles`, `DashboardCandlestickChart`, delayed/stale labels |
| Production deploy | Never auto-applied from this branch |

## Architecture

```
/login → /auth/callback → /terminal
                              │
                              ├─ no favourites → /markets (selection gallery)
                              └─ favourites saved → PersonalTradingWorkspace
                                   ├─ greeting + daily overview
                                   ├─ primary chart (active favourite)
                                   ├─ market review (verified claims only)
                                   └─ widget grid (registry-driven layout)
```

### Preferences

Additive table `member_workspace_prefs` (migration `202607230011_member_workspace_prefs.sql`):

- Own-row RLS (`auth.uid() = user_id`)
- Security-definer RPC `save_member_workspace_prefs`
- Fields: favourites, primary/active instrument, chart TF, widgets JSON, preset, onboarding flags
- **Do not apply to production automatically** — staging first per `docs/SUPABASE_MIGRATION_RUNBOOK.md`
- Client degrades to default workspace if save/load fails

### Instruments

Gallery catalog in `app/lib/workspace/instruments.ts` lists customer-facing markets (ES, NQ, YM, RTY, Gold, Silver, Crude, Bitcoin, FX, FTSE, DAX, Nikkei, …).

- **Covered** instruments map to existing board/candle symbols where the provider supports them.
- **Unsupported** instruments render truthful unavailable states — never fabricated quotes or candles.

### Widgets

Registry in `app/lib/workspace/widgets.ts`. Layout is JSON order/size, not hard-coded page sections. Presets only change widget selection/placement.

### Feature fallbacks

| Capability | Fallback |
|---|---|
| Prefs DB unavailable | In-memory / local defaults; desk still usable |
| Candle entitlement (Free) | LockedPremiumCard |
| News / earnings without provider | Explicit unavailable widget copy |
| Economic calendar empty | Verified empty / EventWindowEmpty pattern |
| Unsupported gallery instrument | “Awaiting verified provider coverage” |

## Release gate

1. Auth regression (magic-link path-only callback, allowlisted next including `/markets`)
2. Candle/freshness tests green
3. Preference ownership / normalize tests green
4. Typecheck + unit tests + secret scan + `git diff --check`
5. Vercel **Preview** only — no production deploy
6. Migration applied only via runbook on staging before any production consideration

Draft PR: https://github.com/nashysaimarkets/nash-ai-markets/pull/27  
Preview (Vercel): https://nash-ai-markets-hjsnzausc-nash-ai-markets.vercel.app  

## Related docs

- `docs/ARCHITECTURE.md`
- `docs/LAUNCH_GATE_STATUS.md`
- `docs/SUPABASE_MIGRATION_RUNBOOK.md`
- `docs/AUTH_DOMAIN_VALIDATION.md`
