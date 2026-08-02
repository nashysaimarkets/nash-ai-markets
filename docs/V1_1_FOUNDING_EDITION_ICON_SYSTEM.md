# Sprint Prestige — Founding Edition Icon System

**Roadmap:** NASH AI Markets Version 1.1 Brand Experience  
**Status:** Design specification only  
**Implementation status:** Standard PWA icon exists; alternate icons are not implemented  
**Non-goal:** No Version 1.0 business logic, entitlement or interface changes

## 1. Design objective

Create one coherent application-icon family:

- **Standard** identifies NASH AI Markets for every member.
- **Founding Edition** quietly recognises a server-verified Founding 100 award.

The Founding Edition is an earned identity treatment, not a higher trading signal,
performance claim or urgency device. Both icons must remain unmistakably the same
product.

## 2. Standard icon

The approved Standard direction is the **Precision Ring** already used by the
production PWA:

- Obsidian field: `#07110F`.
- Carbon inner field: `#0C1512`.
- Precision rings and axes: Founding gold `#E8C673`.
- Verified-intelligence centre: electric blue `#4EA1FF`.
- Optical highlight: warm white `#F4F3EC`.

Construction:

- One outer precision ring and one quieter inner ring.
- Four cardinal axis marks.
- Blue centre with a small warm-white point.
- No text, letters, numbers, gradients, market arrows or price imagery.
- Keep all meaningful geometry inside the Android maskable safe zone.
- Do not draw platform corner radii into iOS masters; allow the operating system
  to apply its mask. PWA and preview exports may include presentation-safe corners.

The master remains a 1024 × 1024 vector artwork with pixel-reviewed exports.

## 3. Founding Edition icon

### 3.1 Concept: Founding Halo

The Founding Edition preserves the Standard geometry and adds only three restrained
distinctions:

1. The outer gold ring becomes a double-line **Founding Halo**.
2. Four small gold registration points sit between the cardinal axes.
3. A subtle gold centre rim surrounds the existing electric-blue intelligence point.

It must not include “100”, a tier name, a crown, a trophy, a currency symbol or a
member number. Those details become illegible at small sizes and would make the
brand feel promotional rather than professional.

### 3.2 Visual constraints

- Standard and Founding Edition must remain recognisable at 16 px.
- The blue centre stays identical in both editions to preserve product recognition.
- Gold coverage may increase by no more than roughly 15% relative to Standard.
- No animation is embedded in the icon.
- The design must survive greyscale, colour-vision simulation and Android masking.
- Product screenshots must label the Founding icon as a membership identity option,
  never as a feature that improves forecasts or market access.

### 3.3 Required asset set

| Platform | Standard | Founding Edition |
|---|---|---|
| iOS | 1024 px App Store master and required bundled sizes | Alternate-icon set bundled in the signed app |
| Android | Adaptive foreground/background and monochrome layers | Alternate adaptive layers and launcher-alias resources |
| PWA | 192, 512, maskable 512 and Apple touch icon | Brand/display asset only; not a switchable installed icon |
| Marketing | SVG master, 1024 PNG, monochrome and presentation sheet | Same deliverables, marked member-exclusive |

Exact store export sizes must be verified against current Apple and Google submission
requirements at implementation time.

## 4. Eligibility and Settings experience

### 4.1 Source of truth

Eligibility must come from the existing server-side Founding 100 award, never from:

- client storage;
- a query parameter;
- profile metadata that a user can edit;
- the selected subscription tier alone;
- a locally modified application bundle.

Recommended rule: an immutable, verified Founding 100 award grants icon eligibility.
This follows the existing permanent Founding badge model; price-lock status is a
separate continuous-subscription rule. If the business wants the icon to require an
active subscription, that change needs an explicit product/legal decision before
implementation.

The operating-system icon files must be bundled with a native app, so they cannot be
treated as secret assets. Security applies to the ability to select the icon through
the official application, not to preventing extraction of public artwork.

### 4.2 Settings design

Add an **App appearance** section to a future native Settings screen:

- Standard card with icon preview and “Available to all members”.
- Founding Edition card with icon preview and verified Founding number.
- Current selection indicated by text, checkmark and accessible selected state.
- A short explanation that the choice changes only the launcher icon.
- Confirmation after the operating system accepts the change.
- A recovery action if the platform rejects or delays the change.

For non-eligible members, the Founding selector and its artwork should be absent from
the application UI rather than presented as an upgrade paywall. Founding status
cannot be purchased after the allocation has been awarded.

Selection should be stored as a non-sensitive preference. The server controls
eligibility; the device may remember the selected icon. On sign-out, the app should
return to Standard unless the signed-in Founding member explicitly chose a shared
device policy during product discovery.

### 4.3 Failure and lifecycle behavior

- Entitlement query failure: keep the current icon and hide switching until verified.
- Never infer Founding eligibility from an offline response.
- Revoked/invalid award: return to Standard after a verified server response.
- Reinstall/new device: start Standard, then offer the saved Founding preference only
  after authenticated entitlement verification.
- Subscription lapse: follow the approved eligibility rule above; do not silently tie
  icon access to lifetime price-lock state.
- Account deletion: return the installed native app to Standard where the platform
  permits it and remove the stored preference.

## 5. Splash screens and launch animation

### 5.1 Shared behavior

- Immediate obsidian background.
- Static icon centred within safe areas.
- No fake loading percentage or market-status animation.
- Never imply that provider data is live before validation completes.
- Hand off to the application as soon as it is usable.

### 5.2 Standard sequence

1. Standard Precision Ring appears.
2. Gold axes resolve over 300–450 ms.
3. Electric-blue centre activates once.
4. Wordmark fades in.
5. Total optional branded motion: 800–1,200 ms maximum.

### 5.3 Founding sequence

1. Founding Halo appears as a static launch mark.
2. The second ring resolves with one restrained 250–350 ms trace.
3. Blue centre activates identically to Standard.
4. A small “FOUNDING EDITION” label may appear below the wordmark in-app only.

The OS-native launch screen itself must remain static. Motion begins only after the
application has rendered. Both sequences require a reduced-motion path that uses a
single static frame and immediate hand-off.

## 6. Platform implementation plan

### 6.1 Native iOS

iOS provides an official alternate-icon API for bundled icon sets.

1. Bundle Standard as the primary icon and Founding Edition as an alternate.
2. Fetch the authenticated Founding entitlement from the server.
3. Render the selector only when entitlement is verified.
4. Invoke the native alternate-icon API from an explicit user action.
5. Reflect the operating system’s success or failure without technical error details.
6. Test first launch, switching, sign-out, reinstall, backup restore and multi-account
   devices.

Platform behavior includes an operating-system confirmation and may change between
iOS releases. Verify against the current SDK during implementation.

### 6.2 Native Android

Android does not provide one equivalent cross-launcher alternate-icon API.
The likely implementation uses predeclared launcher activity aliases:

1. Bundle Standard and Founding adaptive/monochrome resources.
2. Predeclare one launcher alias for each edition.
3. After verified eligibility and explicit selection, enable the selected alias and
   disable the other through a small native module.
4. Handle launcher caching, delayed refresh and manufacturer differences.
5. Ensure the application never temporarily loses every enabled launcher entry.
6. Test Pixel Launcher, Samsung One UI and the minimum supported Android version.

This approach requires a native proof of concept before being promised publicly.
If launcher consistency is unacceptable, ship Standard only on Android and retain
Founding identity inside the app.

### 6.3 Progressive Web App

The current PWA has a complete Standard icon family. Web App Manifest icons are
application-level assets, not authenticated per-member preferences. Installed icons
cannot be switched reliably after installation across iOS Safari, Android Chrome and
desktop Chromium.

Therefore Version 1.1 should:

- keep the installed PWA launcher icon Standard for everyone;
- show the existing verified Founding badge inside authenticated surfaces;
- optionally use the Founding Halo as an in-app Settings preview or profile accent;
- never create a second manifest or ask members to reinstall to simulate exclusivity;
- never cache Founding entitlement responses in the service worker.

If browsers later expose a standard, privacy-safe alternate-icon capability, reassess
it through progressive enhancement. Until then, the Settings switch is native-only.

## 7. Accessibility and quality gates

- Every selector has a programmatic name, description and selected state.
- Icon choice is never communicated by colour alone.
- Touch targets meet the application’s mobile accessibility standard.
- Motion respects reduced-motion settings.
- Both editions pass small-size, mask, dark/light wallpaper and high-contrast review.
- Automated tests prove the server entitlement gates the selector.
- Integration tests cover missing entitlement, query failure, sign-out and account
  switching.
- No API keys, member identifiers or authenticated URLs appear in icon assets,
  metadata, logs or screenshots.

## 8. Recommended release order and effort

| Order | Deliverable | Priority | Estimate |
|---:|---|---|---:|
| 1 | Final Founding Halo design and small-size testing | P1 | 3–5 days |
| 2 | Entitlement/API contract and Settings interaction prototype | P1 | 3–5 days |
| 3 | iOS alternate-icon implementation and QA | P1 | 4–7 days |
| 4 | Android launcher-alias proof of concept | P1 | 4–7 days |
| 5 | Android production hardening and launcher matrix | P1 | 5–9 days |
| 6 | PWA in-app Founding identity consistency review | P2 | 1–2 days |
| 7 | Store screenshots, help copy and support runbook | P2 | 2–4 days |

Total estimated delivery after native foundations exist: **22–39 person-days**.
This excludes the native application programme itself.

## 9. Approval gates

Implementation may begin only when:

1. A native mobile architecture has been approved.
2. Founding icon eligibility is explicitly agreed as permanent-award or active-member
   based.
3. Apple and Google policies have been checked against the current SDK/store rules.
4. The Android launcher proof of concept passes the supported-device matrix.
5. Design, accessibility, security and member-support owners approve both icon sets.

