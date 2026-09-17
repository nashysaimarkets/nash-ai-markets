# Build 41 — accessible Apple Restore

Prepared on 17 September 2026 after the owner reported that purchase and usage-count opt-out worked on build 40, but purchase cancellation and Restore were unavailable after subscribing. He did not recall a free analysis on that build. Historical evidence is preserved separately; unavailable checks are not marked passed.

## Scope

The native home and results screens now contain a compact Apple subscription panel with an always-reachable Restore Purchases button. It displays Apple-reported active access or the existing device free-use state, keeps the button guarded during an operation and shows completion, cancellation, inactive-access and slow-response messages. Existing bounded error diagnostics are available after a failure.

The change reuses the existing StoreKit restore operation. It does not initiate purchases, cancel a subscription, reset the free-use Keychain flag, bypass entitlements or substitute a currency. An active subscription still cannot be used to exercise Apple's new-purchase cancellation sheet; that requires an unsubscribed test session. A fresh-device free allowance still requires separate physical testing. Source inspection shows that the same device free-use flag persists across updates; this may explain the owner's experience, but does not establish what happened on his phone.

## Verified source and web pin

- Web source: `77850015745fdc375b50812afca47b7d68f332bf`
- READY deployment: `dpl_2HQNM98VpghFUBBWcs4V77iFnZ9k`
- Immutable URL: https://nash-ai-markets-rc1olosmo-nash-ai-markets.vercel.app/pocket
- The served-revision verifier passed before selecting this pin.
- Native version: 1.2.12 (41).

## Local verification

- Five new executable restore/render checks passed: active/free/unknown-state reachability, duplicate taps, inactive results, cancellation preserving access and unmount safety.
- Seven existing purchase-flow checks passed.
- Twelve existing StoreKit contract checks passed.
- The existing initial-scan test passed for readable, unreadable, poor and failed analysis outcomes; only a readable result consumes the free use.
- TypeScript checking, secret-pattern scan and ten release/device guard tests passed.
- The local mobile-layout fixture could not be opened in the cloud browser (connection refused), so visual inspection is not claimed. Static render and interaction-handler checks are automated evidence only, not physical StoreKit or iPhone evidence.

No build 41 physical-device checks, upload, processing or App Review submission are established by preparation alone. Those states must be recorded from actual results below.
