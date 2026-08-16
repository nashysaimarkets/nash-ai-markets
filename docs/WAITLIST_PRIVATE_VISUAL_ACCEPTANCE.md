# Project Bullseye — waitlist private visual acceptance

Status: **PRIVATE DESKTOP/FILM/NETWORK PASS / PHYSICAL RESPONSIVE ACCEPTANCE PENDING**

Prepared: **16 August 2026**

Public production: **NO-GO**

Use this protocol only on an owner-only, non-production Bullseye deployment.
It verifies the finished `/waitlist` destination without weakening market-data,
authentication, membership, Stripe, Supabase or production controls.

## Preconditions

- Confirm the deployment is private and not a canonical production domain.
- Confirm the reviewed source contains the explicit example/not-live and
  licensed-data boundaries.
- Confirm the film source is the checksum-recorded v16 master derivative and the
  page uses the first-party 720p web copy, not a third-party player.
- Use `/waitlist` for the standard journey and `/waitlist?plan=founding-pro` for
  the separate Founding Pro copy check.
- Do not submit a real customer address or trigger repeated test messages.
- Do not change DNS, provider credentials, Stripe mode or Supabase configuration
  to make this exercise pass.

## A. First-view truth check

At desktop, tablet and phone widths confirm all of the following before
interacting:

1. The Bullseye identity, headline and waiting-list action appear without
   horizontal scrolling.
2. `Licensed intraday status when available` remains readable.
3. `No card details`, `No automatic billing` and `No guaranteed invitation`
   remain visible near the primary action.
4. The film frame says `EXAMPLE PRODUCT VISUAL` and `NOT LIVE MARKET DATA`.
5. The product map says `EXAMPLE-ONLY PRODUCT MAP` and `NO LIVE MARKET DATA`.
6. The available-without-a-premium-feed and licence-required columns are
   visually distinct.
7. The educational risk footer and Privacy, Terms and Contact routes remain
   present.
8. The Founding Pro variant says interest only and never implies purchase,
   allocation or annual Founding eligibility.

## B. Film playback and data use

The approved source film received owner-reported `PHONE VIDEO PASS` on
16 August 2026. The integrated page received the bounded desktop playback and
network check recorded below; touch, rotation and mute behaviour remain part of
the physical-device pass:

1. Before pressing play, confirm the approved poster is sharp and the example /
   not-live footer remains readable.
2. Confirm the film does not autoplay and no sound begins without a deliberate
   action.
3. Play once with sound and once muted; confirm controls remain operable by touch
   and keyboard and burned captions stay visible.
4. Open the on-page transcript and confirm it matches the on-screen captions.
5. On a throttled or mobile connection, confirm the initial page does not fetch
   the full approximately 3 MB MP4. A small metadata/range request is permitted;
   full transfer should begin only after play.
6. Confirm playback uses the first-party `/launch/video/` asset and makes no
   YouTube, Vimeo, advertising or behavioural-analytics request.

## C. Responsive matrix

| View | Minimum evidence |
|---|---|
| 1440×900 desktop | Hero and form balance cleanly; no clipped product-map or footer content |
| 1280×800 laptop | Headline wraps deliberately; form remains entirely usable |
| 768×1024 tablet | Single-column hero; two-column sections collapse safely; physical evidence still required |
| 390×844 iPhone | No focus zoom on email; all actions meet touch size; legal links wrap |
| 375×812 small phone | No horizontal scroll; CTA and status text remain inside the card |
| 320×568 narrow fallback | Content remains readable at browser zoom; no element blocks submission |

Rotate one phone between portrait and landscape and confirm the page reflows
without losing the typed email or opening an unrelated route.

## D. Keyboard and focus

1. Start at the browser address bar and use Tab only.
2. Confirm focus is visible on the logo, header links, primary/secondary actions,
   email input, submit button, FAQ summaries and footer links.
3. Confirm the sequence follows the visual reading order.
4. Open and close every FAQ with Enter and Space.
5. Confirm no focus target is hidden behind another element and no keyboard trap
   exists.
6. At 200% and 400% browser zoom, repeat the email and FAQ path.

## E. Screen-reader pass

Using VoiceOver and, when a suitable Android device becomes available,
TalkBack:

1. Navigate by headings and confirm there is one clear page title followed by
   logical section headings.
2. Confirm the email field is announced as required, with its guidance.
3. Submit an empty field and confirm native validation identifies the email
   requirement without a network request.
4. On an isolated staging-only synthetic submission, confirm progress is
   announced and the final success message is read once.
5. Force one controlled staging error and confirm it is announced assertively
   once, without marking a payment or membership change.
6. Confirm decorative map dots and evidence lines add no meaningless speech.

Do not use a production-linked authentication or customer-data service for this
acceptance run.

## F. Network and privacy boundary

In browser developer tools, reload `/waitlist` and confirm:

- no market-data provider request is made;
- no advertising, behavioural analytics or social-pixel request is made;
- no Stripe request is made merely by viewing or joining the list;
- no Supabase/authentication request is made merely by viewing the page;
- no third-party video request is made and the first-party MP4 is not fully
  transferred before a deliberate play action;
- the only intended write during the designated staging submission is one
  same-origin `POST /api/waitlist`;
- no email address, secret or raw provider response appears in the URL or client
  log.

Remove the single synthetic record after the evidence has been retained under
the approved retention exercise. Never create repeated addresses to manufacture
proof.

## G. Share and metadata check

Inspect the rendered document metadata and confirm:

- canonical URL is `/waitlist`;
- Open Graph and X/Twitter use `/waitlist-og.png`;
- the raster is 1200×630 and its alt text matches the truthful product promise;
- no example figure or implied live-market claim is present in the card;
- the public card does not expose a private-preview URL or token.

## H. Acceptance record

Record only:

| Field | Evidence |
|---|---|
| Private deployment reviewed | Protected Vercel deployment `dpl_C32r2uV2SrFjDhzt1ozBqq4n9TqP`; branch `preview/bullseye-waitlist-film-e54e17a` |
| Source commit | Full local checkpoint `e54e17ab199ee5c82b2d41ffcf1870067d50d90c`; preview runtime commit `49e61ea049b4f9b76ea4ac4dce8b17562f0df6d7` |
| Reviewer and date | OpenAI Codex private-browser review, 16 August 2026, 21:26 BST |
| Approved source film on phone | **PASS — Chris Nash, 16 August 2026** |
| Integrated page film playback | **DESKTOP PASS** — no autoplay; deliberate play/pause worked; captions and transcript present. Physical touch/mute check remains |
| Desktop/laptop result | **PASS** — Chrome at 1363×936; polished hero/film presentation and no horizontal overflow |
| iPhone portrait/landscape | **PENDING — PHYSICAL PAGE RUN** |
| Tablet result | **PENDING — PHYSICAL PAGE RUN** |
| VoiceOver result | **PENDING FOR THIS PAGE**; earlier authenticated-preview VoiceOver evidence is separate |
| TalkBack result | **DEVICE UNAVAILABLE** |
| Keyboard and zoom | **PARTIAL PASS** — transcript opens with Enter; complete Tab path and 200%/400% zoom remain |
| Network/privacy boundary | **PASS FOR VIEW/PLAYBACK** — first-party media only; no app tracker or third-party player; pre-play buffer stopped at about 2.435 seconds; no runtime errors. Vercel's protected-preview toolbar injection is platform tooling, not application telemetry |
| Standard and Founding copy | **PASS** — both variants retain the non-purchase, no-card, no-guaranteed-place boundary |

Additional connected-build evidence:

- the protected preview reached `READY` on Vercel;
- Next.js 16.2.12 compiled successfully, ran TypeScript and completed the build;
- `/waitlist` returned HTTP 200 with `x-robots-tag: noindex`;
- the film remained paused at time zero until a deliberate click;
- only roughly 2.435 seconds were buffered before play, rather than the full
  25.008-second film;
- no application error, warning or fatal runtime entry appeared in the checked
  30-minute window;
- the temporary preview toolbar referenced `vercel.live`; the application
  itself referenced no YouTube, Vimeo, advertising or analytics host.

## Stop conditions

Stop acceptance and return to source review if any screen:

- presents example, delayed, stale or unavailable information as live;
- makes a payment, entitlement or guaranteed-place implication;
- sends a market-data, advertising or payment request unexpectedly;
- leaks a private URL, token, email or customer detail;
- loses the risk/data boundary when cropped or zoomed;
- cannot be completed by keyboard or the available screen reader.

Passing this private protocol clears the landing-page visual gate only. It does
not clear public production, paid advertising, licensed intraday data,
transactional email, legal/privacy review or the final launch go/no-go.
