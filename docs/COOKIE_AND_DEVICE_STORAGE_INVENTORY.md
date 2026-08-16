# Cookie and Device-Storage Inventory

Source review: **16 August 2026**

## Decision

**REPOSITORY INVENTORY COMPLETE. PECR/NOTICE CLASSIFICATION REQUIRES QUALIFIED
APPROVAL.**

No marketing analytics, advertising pixel, behavioural tracker, IndexedDB use
or customer-route service-worker cache was found in the reviewed repository.
This inventory covers first-party source behaviour; a final browser run must
also inspect cookies/storage added by the selected deployed vendors.

## Cookies

| Name/pattern | Set by | Purpose | Lifetime in source | Preliminary classification |
|---|---|---|---|---|
| Supabase SSR authentication cookie(s), dynamic names | `@supabase/ssr` | Passwordless session, refresh and protected-route access | Controlled by Supabase auth/session configuration | Strictly necessary candidate; verify exact deployed names, flags and expiry |
| `nam_auth_next` | Bullseye login/callback | Preserve a validated same-origin post-auth route | 900 seconds; deleted on callback/confirmation | Strictly necessary authentication navigation |
| `nash_desk_workspace_v1` | Trading Desk | Server-readable workspace layout, selected market and display preferences | 180 days | Functional/user-requested candidate; qualified consent/exemption decision required |

The explicit Bullseye cookies use `SameSite=Lax`; `Secure` is appended on HTTPS.
The final browser audit must record the Supabase-generated cookie flags without
copying cookie values.

## Local and session storage

All rows are first-party device storage. They remain in that browser and are not
sent to a separate vendor merely because they are stored. Some values can still
be personal data when linked to a member/device, and PECR can apply even when a
value is not personal data.

| Key | Storage | Purpose | Source lifetime/reset | Preliminary classification |
|---|---|---|---|---|
| `nash-pwa-install-session-shown` | Session | Avoid repeating the install prompt in one tab session | Browser tab/session | Functional |
| `nash-pwa-install-dismissed` | Local | Suppress the install prompt after dismissal | Read for 14 days; browser clear removes value | Functional |
| `nash-presentation-mode` | Local | Remember presentation mode | Until changed/browser clear | User preference |
| `bullseye:login-sting:pending` | Local | Play the optional login sting once after a successful login flow | Removed after it is read; stale value ignored | Authentication experience |
| `bullseye:login-sting:muted` | Local | Remember sound choice | Until changed/browser clear | User preference |
| `nash-ai-coach-open-v1` | Local | Remember coach-panel open state | Until changed/browser clear | User preference |
| `nash-oracle-dashboard-workspace-v1` | Local | Dashboard market, section order, pins, expansion and density | Until reset/browser clear | User-requested workspace |
| `nash-oracle-checklist-v1` | Local | Daily preparation checklist | Current trading day is used; reset/browser clear | User-entered process state |
| `nash-oracle-process-v1` | Local | Device-only process-consistency history | Until product reset/browser clear | User-entered process history; retention control required |
| `nash-oracle-return-visit:v1` | Local | Compare the current verified context with the previous visit | Comparison expires after 36 hours; stored value persists until replaced/reset/browser clear | Automatic convenience; consent/strict-necessity review priority |
| `nash-oracle-confidence-v1` | Local | Compare confidence/evidence changes | Comparison expires after 36 hours; stored value persists until replaced/reset/browser clear | Automatic convenience; consent/strict-necessity review priority |
| `nash:personal-level-planner:v1` | Local | User-entered personal support/resistance levels | Explicit clear control/browser clear | User-requested content; prominent device-only disclosure exists |
| `bullseye-elite-onboarding-v1` | Local | Quick-start completion and dismissal | Until changed/browser clear | User-requested onboarding state |
| `nash:brief:preparation:v1` | Local | Morning Brief preparation checklist | Until changed/browser clear | User-entered process state |
| `nash-desk-view-v1` | Local | Trading Desk selected view | Until changed/browser clear | User preference |
| `nash-desk-markets-collapsed-v1` | Local | Trading Desk collapsed market-rail state | Until changed/browser clear | User preference |
| `nash-desk-workspace-v1` | Local | Full Trading Desk workspace/layout | Until changed/browser clear; mirrored to 180-day cookie | User-requested workspace |
| `nash-desk-journal-v1` | Local | Device-only Trading Desk notes/checklists by market/day | Until browser clear; no complete in-product bulk-clear control verified | User content; retention/reset control priority |
| `nash.bullseye.first-five.v1` | Local | Public launch-preview session challenge progress | Explicit reset/browser clear | Optional public-demo state |

## Cache Storage / PWA

The service worker uses versioned `nash-shell-v2-shell` and
`nash-shell-v2-static` caches. It stores only the offline page, manifest, icons
and eligible same-origin public static assets. Account, API, auth, billing,
Dashboard, Morning Brief, Trading Desk and other personalised routes are
network-only. Old versioned caches are deleted on activation; browser site-data
clear or unregistration removes current caches.

## Optional third-party storage

- TradingView is click-to-load. Its current widget behaviour and commercial
  terms must be rechecked immediately before launch; Bullseye must not promise
  that a third party never changes its storage behaviour.
- YouTube uses `youtube-nocookie.com` and is click-to-load. Privacy-enhanced mode
  reduces pre-play tracking but still requires a deployed-browser/vendor review.
- Stripe Checkout/customer portal are external navigations governed by Stripe's
  own notice and storage on those pages.

## Required launch actions

1. Run a clean-profile browser storage inspection on the exact private release
   artifact before and after login, each preference action, TradingView load,
   YouTube play and Stripe test-mode navigation. Record names, purposes, flags
   and expiry only—never values.
2. Ask the qualified privacy reviewer to classify the two automatic comparison
   stores and the 180-day workspace cookie first.
3. Add an in-product **Clear device data** action covering every Bullseye local
   key before claiming users can reset all device state.
4. If any item is non-essential and not exempt, prevent it from being set until
   valid consent; make withdrawal as easy as consent.
5. Update the Privacy Policy/cookie information with the approved exact
   inventory and review it whenever a key or third-party surface changes.

## Verification command

The source inventory can be repeated without network use:

```sh
rg -n "localStorage|sessionStorage|document\\.cookie|cookies\\(|indexedDB|caches\\." app utils public
```

See [UK legal and privacy approval pack](UK_LEGAL_PRIVACY_APPROVAL_PACK.md) and
the ICO's [cookies and similar technologies guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/).
