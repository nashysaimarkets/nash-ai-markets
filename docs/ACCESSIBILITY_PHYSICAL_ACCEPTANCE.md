# Physical Screen-Reader Acceptance

Evidence date: **16 August 2026**

## Current decision

**PARTIAL PASS — physical iPhone VoiceOver passed; Android TalkBack remains
pending.**

This record separates automated/keyboard evidence from actual assistive-
technology use. A desktop accessibility tree or browser automation is not
represented as physical VoiceOver or TalkBack evidence.

## Evidence already held

| Surface | Evidence | Status |
|---|---|---|
| Private example preview on phone | Owner reported `PHONE PASS`, including repaired menu auto-close | Pass for ordinary touch navigation |
| Private example preview by keyboard | Morning Brief → Trading Desk stayed inside the protected preview; disabled Journal remained non-navigable and `aria-disabled` | Pass |
| Preview safety | Example-only disclosure and `noindex, nofollow` remained present; writes and sign-out remained disabled | Pass |
| iPhone VoiceOver | Chris Nash reported `VOICEOVER PASS` against the five-check private-preview protocol on 16 August 2026 | Pass |
| Android TalkBack | Owner confirmed no Android device is currently available; borrowed device or trusted tester required | Pending — device unavailable |
| Authenticated tablet/mobile routes | Isolated-staging physical run required | Pending |

## Five-check iPhone VoiceOver run

Use the exact private example preview. Do not request a new sign-in link, enter
customer data or leave the preview.

1. In iOS, enable **Settings → Accessibility → VoiceOver**.
2. Open the private preview and swipe from the top of the page.
3. Confirm the **Example-only member experience** disclosure is announced
   before any sample market figures.
4. Confirm the member-menu control is announced as a button with an open/closed
   state. Open it, activate **Trading Desk**, and confirm the menu closes.
5. Confirm the new page heading is announced, focus is not trapped, and
   **Journal** is announced as unavailable/disabled and does not navigate.

Record only `PASS`, or `FAIL` plus the affected label/step. Do not record an
account address, device serial number, screenshot containing a sign-in link or
other identifier.

## Five-check Android TalkBack run

Use Chrome on a physical Android phone against the same private preview.

1. Enable **Settings → Accessibility → TalkBack**.
2. Confirm the example-only disclosure precedes sample figures.
3. Confirm the member menu exposes role and expanded/collapsed state.
4. Activate **Trading Desk** and confirm the menu closes and the new heading is
   announced without a focus trap.
5. Confirm disabled Journal is announced unavailable/disabled and Back does not
   expose a route outside the preview.

## Acceptance log

| Platform | Tester | OS/browser version | Result | Evidence note |
|---|---|---|---|---|
| iPhone / VoiceOver | Chris Nash | iOS/Safari version not supplied | **PASS** | Owner reported `VOICEOVER PASS` for all five private-preview checks on 16 August 2026 |
| Android / TalkBack | **UNASSIGNED** | No device available | **PENDING — DEVICE UNAVAILABLE** | Chris Nash confirmed `NO ANDROID` on 16 August 2026; borrowed device or trusted tester required |

## Pass rule

The physical screen-reader gate clears only when both rows are `PASS`, or when a
qualified accessibility reviewer documents why a platform is out of launch
scope. Any failure affecting disclosure order, navigation state, route
isolation, focus trapping or safety warnings is release-blocking until fixed and
retested.

The wider installation, offline, update, zoom and tablet matrix remains in
[PWA_DEVICE_TEST_CHECKLIST.md](PWA_DEVICE_TEST_CHECKLIST.md).
