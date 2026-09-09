# Pocket Bullseye Apple update — 9 September 2026

## Approved scope

Chris requested the Apple update after accepting the restored original scanner and cinematic pacing. Preserve the analysis engine, model, prompts, evidence gates, price calculations and native progress/timeline behavior. Retain captions below the chart and the verified direction-badge spacing correction.

## Verification

- Browser checks of actual result components at 375, 393 and 430px passed, using clearly labelled screenshot-value fixtures. This is not physical-iPhone verification.
- After AI credits were topped up, one live US500 chart scan returned HTTP 200 in 86.1 seconds, correctly identifying US 500 (DFB), 1d and current price 7670.93 and returning support/resistance analysis with locked identity/scale gates.
- The native immutable server passed `scripts/verify-capacitor-server.mjs` with its exact served revision.
- Existing Apple integration status run `6aa14d68568f7901990f0fe1` succeeded. Apple reported version 1.2.8 IN_REVIEW; latest uploaded build was 25, ID `be169f20-21d9-4738-bd75-eadda41bb288`. Version 1.2.7 was READY_FOR_SALE.

## Build 26

- Version/build: 1.2.8 (26).
- Source branch: `feat/pocket-cosmic-cinema-2026-09-09`.
- Build commit: `dd968df370bc277c38d2f9b3de6c2b5ca79942eb`.
- Exact tree: `40975f5b66371747a1e36ef380f4059f6e3b433c`; local equivalent commit `4c65164`.
- Server: https://nash-ai-markets-jnkpvjl86-nash-ai-markets.vercel.app/pocket
- Served revision: `feedfb6ff0133d02931eef4797b53b3c0240034b`.
- Vercel deployment: `dpl_2i9p4gXKSGvibfgDXnychDGA72ve`.
- Codemagic run: https://codemagic.io/app/6a90a2752815719e2161c656/build/6aa14f9ee855647b370e10b4
- Workflow: `pocket-bullseye-ios-testflight`, index 23.
- Release pin declares intended tag `ios-v1.2.8-appstore.3`; no tag was created, because the run was started manually from the verified branch head.

The workflow runs the existing release gates, builds and uploads the signed archive, then replaces the prior submission and submits for App Review with release after approval. Replacing the older version restarts review; Chris's release authorization covers this update.

The first launch attempt was paused by automatic approval review over commit selection. A read-only GitHub check confirmed the selected branch head was the new build-26 commit, and the browser showed the old commit option was unselected. The workflow was refreshed; launch succeeded and the new run explicitly reports commit dd968df.

## Current outcome

All 955 unit tests passed, with zero failures or skips. The security scan passed across 909 version-control candidates. The immutable server check passed inside the release run, and signed archive/export succeeded using Xcode 26.6.

Apple accepted the 1.2.8 (26) upload without errors at 2026-09-09T12:32:40Z. Build/delivery ID: `5ba1a768-d690-429f-9586-ecdde6f3bda4`. Build and upload took 4m 48s. Apple subsequently completed processing the uploaded build and accepted the updated TestFlight notes.

Post-processing completed successfully in 3m 38s. The earlier review submission was withdrawn and build 26 was submitted through a new review submission:

- Review submission: `43ff6788-6c33-4167-a321-2e62435755da`.
- App Store version ID: `e84630c1-fac3-4229-b5e6-fe47ef722dd6`.
- Apple state: **WAITING_FOR_REVIEW**.
- Submitted: **2026-09-09T12:36:19.989Z** (13:36 BST).
- Release setting: **AFTER_APPROVAL**.
- Review details: https://appstoreconnect.apple.com/apps/6806004581/appstore/reviewsubmissions/details/43ff6788-6c33-4167-a321-2e62435755da

The upload and replacement App Review submission are complete. The update is awaiting Apple's review and is not yet claimed live. No further build or resubmission is needed for this release.
