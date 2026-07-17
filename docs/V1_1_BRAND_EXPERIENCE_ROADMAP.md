# NASH AI Markets — Version 1.1 Brand Experience Roadmap

**Status:** Planning proposal  
**Target:** After Version 1.0 release candidate stabilisation  
**Scope:** Brand, installable mobile web, customer experience, community and launch media  
**Guardrail:** This roadmap does not change Version 1.0 functionality or authorise production implementation.

## 1. Executive direction

Version 1.1 should make NASH AI Markets feel recognisable, installable and rewarding without weakening Bullseye's core promises: verified data, explicit market status, deterministic safety controls and no fabricated performance claims.

The recommended order is:

1. Establish the brand system and final icon family.
2. Make the existing web application a safe, installable PWA.
3. Refine onboarding, profiles and achievements using the existing membership model.
4. Pilot the opt-in Founding Member Wall.
5. Produce launch media from the approved brand system and real product captures.
6. Start native-app discovery only after Version 1.0 production behaviour is stable.

## 2. Current foundation

| Capability | Current state | Version 1.1 treatment |
|---|---|---|
| Web app manifest | Exists with standalone display, theme colour and SVG favicon | Enhance for full installability |
| Service worker and offline shell | Not present | New |
| Platform-specific app icons | No complete PNG/maskable/Apple icon family | New |
| Dark terminal identity | Established across the terminal and member experience | Consolidate into tokens and guidelines |
| Typography | Geist and Geist Mono are established; some legacy styles use other families | Standardise |
| First-run preferences | Three-step onboarding already captures experience, interests and notifications | Evolve into an interactive walkthrough |
| Member profile | Display name and subscription status already exist | Enhance |
| Founding 100 badge | Existing entitlement-backed badge and price-lock status | Preserve; use as the first achievement type |
| General achievement system | Not present | New |
| Founding Member Wall | Not present | New, opt-in and privacy-first |
| Native iOS/Android apps | Not present | Plan after Version 1.0 |

## 3. Priority and effort

Effort is expressed in focused person-days and includes implementation, review, automated tests, accessibility checks and documentation. It excludes external legal review and app-store review time.

| Priority | Workstream | Effort | Release gate |
|---|---:|---:|---|
| P0 | Brand tokens, typography and asset guidelines | 6–10 days | Before other visual production |
| P0 | App icon family and splash assets | 5–8 days | Before PWA release |
| P0 | PWA installability, safe caching and device validation | 10–16 days | Version 1.1 |
| P1 | Welcome walkthrough and onboarding refinement | 8–13 days | Version 1.1 |
| P1 | Achievement framework and profile enhancements | 10–16 days | Version 1.1 |
| P1 | Marketing asset production | 10–18 days | Version 1.1 campaign |
| P2 | Founding Member Wall private beta | 12–20 days | Staged after privacy review |
| P2 | Native app discovery and shared-contract preparation | 18–27 days | After Version 1.0 |
| P2 | Native app implementation and store release | 55–90 days | Separate mobile release |

**Version 1.1 web and brand estimate:** 61–101 person-days.  
**Native programme estimate:** a further 73–117 person-days, typically 10–16 calendar weeks for a small cross-functional team.

## 4. Branding

### 4.1 Premium app icon concepts

All concepts use an obsidian field, accessible founding gold and a restrained electric-blue signal. They must remain recognisable at notification size and work without text.

1. **Precision Ring — recommended**
   - Matte-black square with softly rounded platform-safe corners.
   - A fine gold targeting ring represents disciplined selection.
   - A small electric-blue centre point represents current verified intelligence.
   - Best fit with the Bullseye name and simplest at small sizes.

2. **Signal Aperture**
   - Four restrained gold corner marks frame an electric-blue pulse.
   - Conveys market focus and live status without resembling an exchange logo.
   - Strong option for motion: the aperture can resolve into the splash mark.

3. **N Signal Monogram**
   - Geometric gold “N” built from two market-signal strokes.
   - One blue node marks the point of validated insight.
   - Strong corporate identity, but requires more small-size testing.

Required outputs:

- Editable vector master and monochrome master.
- iOS, Android adaptive foreground/background and maskable PWA variants.
- Platform icon exports, favicon set and social avatar.
- Light/dark presentation sheets at 16, 24, 32, 48, 128, 192, 512 and 1024 px.
- Legibility, colour-blindness and unintended-symbol review before approval.

### 4.2 Splash-screen animation

Recommended sequence, lasting **800–1,200 ms**:

1. Obsidian background appears immediately.
2. Gold precision ring resolves with a short opacity/scale transition.
3. Electric-blue point activates once.
4. NASH AI MARKETS wordmark fades in, then hands off to the loaded application.

Rules:

- Never delay usable content merely to finish animation.
- Never show false progress or imply market data has loaded.
- Provide a static fallback and respect `prefers-reduced-motion`.
- Use platform-native launch assets where animation is unavailable.
- Keep the web animation CSS/SVG based and below an agreed performance budget.

### 4.3 Typography and colour system

Use a documented token layer rather than page-specific colour values.

| Role | Proposed foundation | Use |
|---|---|---|
| Display and UI | Geist | Headlines, labels, navigation and body |
| Market data | Geist Mono | Prices, timestamps, technical status and tabular values |
| Obsidian | `#07110F` | Primary background |
| Carbon | `#0C1512` | Elevated surfaces |
| Warm white | `#F4F3EC` | Primary text |
| Muted grey | `#9CA7A1` | Secondary text |
| Signal green | `#38F28E` | Verified positive/available states only |
| Founding gold | `#E8C673` | Founding status and premium accents |
| Electric blue | `#4EA1FF` | Focus, selection and neutral live intelligence |

These are candidate tokens, not production approval. Every text/background combination must pass WCAG contrast testing. Red, amber and green must never be the sole carrier of meaning. Gold must not be used to manufacture urgency or imply guaranteed value.

### 4.4 Brand asset guidelines

Create a concise brand manual containing:

- Primary, compact, monochrome and icon-only lockups.
- Minimum size and clear-space rules.
- Approved colour pairings and inaccessible combinations.
- Typography hierarchy, data-table conventions and number formatting.
- Iconography: precise line icons with consistent stroke weight.
- Motion principles: purposeful, short, interruptible and reduced-motion safe.
- Screenshot rules requiring real or explicitly labelled preview data.
- Prohibited claims: guaranteed outcomes, fabricated accuracy, false scarcity or personalised advice.
- Source ownership, licence register, file naming and version control.
- Export matrix for web, email, social, presentations and app stores.

## 5. Mobile experience

### 5.1 PWA readiness assessment

The application is **partially PWA-ready, but not currently a complete installable product**.

| Requirement | Assessment |
|---|---|
| Responsive web application | Strong foundation; final device QA still required |
| Web manifest | Present |
| Standalone display and theme | Present |
| Complete 192/512 icon set | Missing |
| Maskable Android icon | Missing |
| Apple touch icon and iOS metadata | Missing/incomplete |
| Service worker | Missing |
| Offline navigation shell | Missing |
| Install education and update UX | Missing |
| Mobile install/device test matrix | Missing |

### 5.2 PWA implementation plan

1. **Asset completion**
   - Approve one icon concept.
   - Export 192 px, 512 px and maskable variants plus Apple touch assets.
   - Add platform-safe theme and launch-screen metadata.

2. **Safe service worker**
   - Cache only versioned application-shell and static brand assets.
   - Do not cache authentication responses, account pages, billing routes, admin data, live market responses or personalised Morning Brief content.
   - Use explicit offline/unavailable states; never replay old market data as live.
   - Provide deterministic update, cache invalidation and rollback behaviour.

3. **Install and recovery UX**
   - Add a contextual install prompt only where platform APIs permit it.
   - Document iOS “Add to Home Screen” without blocking normal use.
   - Show a clear reconnect action after network loss.
   - Announce application updates and avoid reloads during form submission.

4. **Validation**
   - Test install, launch, sign-in restoration, sign-out, update and uninstall/reinstall.
   - Cover current iOS Safari and Android Chrome, tablet layouts and reduced motion.
   - Verify offline market panels remain fail-closed.
   - Run Lighthouse PWA/accessibility checks as supporting evidence, not as the sole acceptance test.

### 5.3 Native iOS and Android plan after Version 1.0

**Recommended approach:** a shared React Native/Expo client with native modules where necessary, subject to a short technical discovery. This can share TypeScript contracts and validation logic without wrapping the website or coupling the UI to Next.js.

| Stage | Outcome | Effort |
|---|---|---:|
| A. Discovery | User journeys, store rules, threat model, notifications and analytics decisions | 8–12 days |
| B. Shared contracts | Extract audited schemas, engine DTOs and provenance rules into framework-neutral packages | 10–15 days |
| C. Mobile foundation | Navigation, design tokens, secure session storage, deep links, error telemetry and CI builds | 15–25 days |
| D. Core parity | Dashboard, Brief, terminal summaries, profile and subscription-management hand-off | 25–40 days |
| E. Release QA | TestFlight/closed testing, accessibility, performance, privacy manifests and store submission | 15–25 days |

Native safety requirements:

- Keep OpenAI, Stripe secrets and provider credentials server-side.
- Use hosted checkout/customer portal or approved platform-compliant purchase handling following a legal/store-policy review.
- Store session tokens in Keychain/Keystore, not ordinary local storage.
- Reuse server entitlements; never grant tier access in the client.
- Preserve source timestamps, provenance, delayed/offline labels and fail-closed decisions.
- Do not add push notifications until consent, quiet hours, content safety and deep-link security are designed.

## 6. Customer experience

### 6.1 Welcome walkthrough

Add a skippable, replayable walkthrough after the existing preference flow:

1. How to read market status and freshness.
2. What Bullseye Confidence means—and does not mean.
3. Why no-trade and unavailable states protect the member.
4. Where to find the Morning Brief, terminal and profile.
5. Membership access and preview availability.

Store completion server-side per user and per walkthrough version. Do not block the dashboard after the first optional presentation.

### 6.2 Interactive onboarding

Enhance—not replace—the existing three-step onboarding:

- Add concise examples and inline validation.
- Explain how preferences affect presentation, not personalised advice.
- Allow back navigation, save/resume and keyboard completion.
- Provide an accessible progress summary.
- Add a final review screen and direct link to change preferences.
- Measure completion/drop-off only after analytics consent and configuration are approved.

### 6.3 Achievement badges

Build a server-issued badge model. Founding 100 becomes the first immutable achievement; no badge may be self-assigned by client input.

Candidate later badges:

- Founding 100 Pro / Elite.
- Onboarding complete.
- First verified Morning Brief read.
- Consistent learning milestones based on product use—not trading outcomes.

Avoid badges for profit, trading frequency, leverage or risk-taking. Each badge needs an issue reason, issue timestamp, visibility preference and revocation policy. Badges must remain decorative metadata and must not alter entitlements.

### 6.4 Member profile enhancements

- Profile image or approved initials avatar.
- Optional public display name distinct from legal/billing identity.
- Country/region choice with a “do not display” default.
- Joined date and Founding number when entitled.
- Walkthrough/preferences controls.
- Badge visibility and community opt-in controls.
- Session/security settings and clear account-data request routes.

## 7. Founding Member Wall concept

### 7.1 Experience

A restrained gold-accented gallery celebrates the first members without becoming a leaderboard. Entries may show:

- `Founding Member #001` from the immutable server allocation.
- Optional country flag with accessible country text.
- Join date, preferably month and year by default.
- Optional moderated display name.

Sorting should default to Founding number. The wall must not rank activity, portfolio performance or subscription value.

### 7.2 Privacy and integrity

- Explicit opt-in, off by default, independently revocable.
- Never publish email, legal name, Stripe identifiers, billing status or price-lock state.
- Derive flags from a member-selected country—not IP geolocation.
- Use server-side authorization, row-level security and audited mutations.
- Preserve the awarded Founding allocation when a member hides their entry.
- Escape content, restrict character sets and length, and provide moderation/reporting.
- Define how lapsed members are represented before launch; do not infer it in the UI.
- Complete privacy-policy, retention and data-subject-request review.

### 7.3 Delivery stages

1. UX/privacy prototype with synthetic, clearly labelled design data.
2. Schema, RLS and moderation design review.
3. Internal test with staff-only records.
4. Opt-in Founding cohort beta.
5. Accessibility/security review, then general visibility.

## 8. Marketing asset specifications

All footage must use approved product builds and either verified data or conspicuous `PREVIEW` labelling. No asset may claim an unverified win rate, guaranteed return or artificial Founding availability.

### 8.1 Hero launch video

- **Length:** 45–60 seconds.
- **Masters:** 4K 16:9; derived 9:16 and 1:1 crops; H.264 delivery plus archival mezzanine.
- **Structure:** brand reveal → trusted market status → Morning Brief → decision/no-trade safety → membership experience → factual CTA.
- **Audio:** restrained score and optional voiceover; captions and silent-autoplay version required.
- **Web:** compressed poster image and adaptive video; never block Largest Contentful Paint.

### 8.2 30-second social advert

- **Primary:** 1080×1920, 9:16.
- **Derivatives:** 1080×1350 (4:5) and 1080×1080.
- Hook within two seconds; product proof by five seconds.
- Burned-in captions inside platform-safe areas.
- End card: product name, factual value statement, URL and risk-aware wording.
- Produce captioned, clean and audio-described scripts.

### 8.3 15-second teaser

- **Primary:** 1080×1920, 9:16, with 1:1 derivative.
- Single story: “Know when the data is ready—and when to stand aside.”
- Maximum three product shots and one CTA.
- Must remain understandable muted and avoid rapidly flashing status colours.

### 8.4 App Store screenshots

- Maintain editable portrait masters covering the currently required App Store Connect device families; verify exact accepted export sizes at submission time.
- Story sequence: daily mission, Morning Brief, confidence and warnings, terminal, membership/Founding status, profile control.
- Real device UI, readable captions, no unsupported device frames and no invented results.
- Localise editable text separately from screenshots.

### 8.5 Google Play screenshots

- Create 1080×1920 portrait masters plus tablet captures if the native layout supports tablets.
- Sequence should match the actual Android experience and status labels.
- Include an accessible feature graphic derived from the approved icon system.
- Verify current Play Console count, format and dimension rules at submission time.

### 8.6 Website hero graphics

- Desktop master: 2400×1350; mobile master: 1080×1350.
- Export AVIF and WebP with responsive sizes and a high-quality fallback.
- Reserve text-safe space rather than embedding critical text in the image.
- Provide dark-theme poster, Open Graph image and reduced-motion/static alternatives.
- Use cropped real interface compositions with explicit market-state provenance.

## 9. Recommended release order

### Release 1.1A — Identity foundation

Brand tokens, icon approval, guidelines, asset library and typography consolidation.

### Release 1.1B — Installable experience

PWA assets, safe service worker, offline states, install guidance and iOS/Android browser validation.

### Release 1.1C — Member journey

Welcome walkthrough, refined onboarding, profile controls and achievement framework.

### Release 1.1D — Founding community beta

Opt-in Founding Member Wall behind a controlled rollout, with moderation and privacy review.

### Release 1.1E — Campaign release

Hero video, social edits, store screenshot system and website graphics, all captured from the approved release.

### Post-1.1 — Native programme

Discovery and shared-contract work can begin during 1.1, but native apps should ship as a separately tested release after production web telemetry confirms stable workflows.

## 10. Success measures

- PWA installs and updates without stale authenticated or market information.
- No preview, cached or offline data is presented as live.
- Walkthrough and onboarding are keyboard- and screen-reader-completable.
- Members can understand plan, access, Founding status and data quality without support.
- Community publication is always explicit and reversible.
- Marketing captures match production behaviour and pass compliance review.
- Brand assets remain recognisable and readable at required sizes.
- Native clients pass parity, security, accessibility and store-policy reviews before release.

## 11. Approval gates

Implementation should not begin until:

1. The Version 1.0 production behaviour and visual baseline are frozen.
2. One icon direction and the candidate design tokens are approved.
3. PWA cache boundaries receive security review.
4. Community consent, moderation and retention rules receive privacy review.
5. Native billing and store-policy approach receives commercial/legal review.
6. Marketing claims and captured data receive final truthfulness review.

