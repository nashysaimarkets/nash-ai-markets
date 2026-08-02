# PWA Real-Device Test Checklist

Test the exact staging build over HTTPS. Use dedicated test accounts and remove
the installed app between clean-install cases. Record OS/browser versions, not
device identifiers or account details.

## Common preflight

- [ ] Manifest loads with `id`, `start_url` and `scope` set to `/`.
- [ ] Display mode is `standalone`.
- [ ] 192 px, 512 px and maskable icons return successfully.
- [ ] Apple touch icon and configured launch images return successfully.
- [ ] `/sw.js` has root scope and a revalidation policy.
- [ ] Service worker caches only public shell/static assets.
- [ ] Account, API, auth, billing, dashboard, brief, profile and terminal routes
      are network-only.

## iPhone Safari

- [ ] Open staging in Safari; Share → **Add to Home Screen**.
- [ ] Name is `NASH AI`; icon is sharp with no unintended white border.
- [ ] Launch opens standalone and shows an appropriate static splash image.
- [ ] Safe-area content is not obscured by notch/home indicator.
- [ ] Magic-link login returns to the correct staging origin.
- [ ] Session survives closing/reopening the installed app.
- [ ] Sign-out removes access.
- [ ] Offline navigation shows only the fail-closed offline screen.
- [ ] Reconnection and manual retry restore the network experience.
- [ ] A waiting update appears without automatic form reload; choosing Update
      applies it once.
- [ ] Stripe test Checkout leaves the PWA safely and `/welcome` returns to the
      staging origin without claiming premature entitlement.
- [ ] VoiceOver announces navigation, form labels, status, errors, install
      guidance and no-trade warnings in a logical order.

## iPad Safari

- [ ] Repeat iPhone installation, login, update, offline and sign-out checks.
- [ ] Splash artwork is not stretched or cropped incorrectly in portrait and
      landscape.
- [ ] Pricing comparison, chart and terminal panels have no horizontal page
      overflow.
- [ ] Pointer, keyboard and VoiceOver focus are visible and ordered.

## Android Chrome

- [ ] Browser install prompt appears only when platform criteria are satisfied.
- [ ] Installed launcher icon uses the maskable asset correctly.
- [ ] App launches standalone inside scope.
- [ ] Login, persistence, sign-out, update, offline and reconnect checks pass.
- [ ] Stripe test Checkout and return URLs remain on staging.
- [ ] TalkBack announces controls, live regions and warnings.
- [ ] Back navigation does not reveal protected cached pages after sign-out.

## Samsung Internet

- [ ] Add/install action is available according to the current browser version.
- [ ] Icon, name, standalone launch and safe-area layout are correct.
- [ ] Login persistence and sign-out behavior match Android Chrome.
- [ ] Offline screen replaces private/live content.
- [ ] Update/reconnection does not loop or show stale market guidance.
- [ ] TalkBack and 200% text scaling retain usable controls.

## Cross-device update test

1. Install the current staging candidate.
2. Begin a non-destructive form entry but do not submit.
3. Publish a staging-only build with a harmless version marker through the
   approved deployment process.
4. Wait for or trigger the hourly service-worker update check.
5. Confirm the application does not reload automatically.
6. Choose **Update** and confirm exactly one reload into the new build.
7. Verify protected data was not stored in Cache Storage.

## Acceptance

- No preview, delayed, cached, fallback or offline state is labelled Live.
- No private route or response is available from the service-worker cache.
- Login persists only until explicit sign-out/session expiry.
- Sign-out prevents back-navigation access.
- Install, dismissal, update and uninstall never block the normal web journey.
- VoiceOver/TalkBack, keyboard, reduced motion, zoom and touch targets remain
  usable.

