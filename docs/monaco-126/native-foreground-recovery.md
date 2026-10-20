# iPhone foreground subscription recovery

Isolated source continuation of PR131 `2994b2859ef7bcc22b9ee38a5b966e1806e47994`. This patch changes only the existing iOS subscription bridge and its offline regression harnesses. It does not change the public name, product, price, entitlement verifier or any live store/customer record.

## Reproduced defect and repair

Previously, subscription controls could continue showing READY / APPLE ACCESS VERIFIED after the app returned from suspension unless StoreKit independently emitted a transaction update. Expiry, out-of-app cancellation, revocation or a changed Pocket session need not produce that event. The existing server routes still enforced paid admission, but the customer presentation could stay stale.

The existing Capacitor App plugin now feeds the same source-ordered subscription bridge as StoreKit updates. Backgrounding invalidates outstanding verification and clears local presentation to VERIFYING. Foreground return reads current native evidence and verifies it against the current Pocket server session. A late result, background StoreKit event or removed listener cannot restore the badge. Native read/server failure produces ERROR and preserves the existing recovery-only UI. Partial registration failure removes the already registered StoreKit listener. The controls invalidate initialization and enter ERROR when either required update listener cannot be registered, including failure after a successful initial check. Cleanup removes both listeners.

## Evidence

- Actual exported bridge regression matrix on baseline: **1 PASS / 7 FAIL**, 8 tests, 0 skips, exit1. All seven failures expose absent lifecycle handling/cleanup; the web no-listener control passes.
- Same matrix after repair: **8/8 PASS**, 0 skips. Cases cover background stale-response rejection, fresh foreground native/server evidence, read failure, StoreKit-versus-resume ordering, background event hold, teardown, failed listener registration and web isolation.
- Combined `node --test tests/pocket-native-foreground-recovery.test.ts tests/pocket-native-subscription-recovery.test.ts tests/pocket-native-server-bridge.test.ts`: **33/33 PASS**, 0 skips. Prior phase/harness regressions remain covered. Two actual-control-effect regressions also prove that early/late listener registration failure clears presentation, exposes Retry and prevents late initialization from reopening a purchase offer. Before the control fix the original recovery suite produced9PASS/2FAIL; after it11/11PASS. The old actual-bridge harness now supplies an inert App listener stub and waits for each async event verification to start before testing reply ordering.
- Full strict `npm run typecheck`, focused ESLint on the three changed TypeScript files and `git diff --check`: PASS.

These tests execute the real exported JavaScript bridge body with synthetic native lifecycle/transaction events and mocked server verification. They make zero StoreKit, Apple, payment or external-provider requests. They do not establish native plugin delivery on a signed physical iPhone, actual expiry/refund behavior, StoreKit approval or production readiness. Physical-device acceptance must include background → resume during a verified subscription, expiry/cancellation, session change and an in-progress purchase/restore against the exact signed build and immutable web pin.

Rollback is reverting this isolated unpublished source change; retain server-paid admission and the accepted £4.99 customer binding. Root alone publishes the integration successor; frozen PR127–132 remain untouched.

## Initial app-state race found by independent review

The first foreground patch assumed an active initial app. Capacitor lifecycle listeners do not replay current state, so backgrounding before listener registration could leave a false active assumption. Independent review also identified the controls' parallel initialization path as a bypass of an unknown foreground state.

The bridge now starts with foreground UNKNOWN and immediately publishes VERIFYING, superseding that parallel initialization. After registering both listeners it reads App.getState once; any lifecycle event observed during setup or while the snapshot is pending takes precedence over the snapshot. Only a known active state starts a current native/server check. Rejected or malformed initial state reports ERROR. The handle is available without waiting on the snapshot, allowing teardown to suppress all late work.

Added seven actual-source regression cases: inactive initial state; background transition during listener registration; late active/inactive snapshots versus newer opposing events; rejected/malformed app state; unmount during snapshot; and real bridge + controls initialization bypass. Before this correction the expanded foreground matrix produced11PASS/3FAIL and the controls matrix11PASS/1FAIL. After correction the combined native foreground/recovery/bridge suite passes33/33,0skip. This remains offline source evidence; actual signed lifecycle delivery and physical-device acceptance remain BLOCKED.

The shared direct purchase/restore/access verification boundary also requires a fresh active App.getState observation after server verification, so a Restore invoked during unknown initialization cannot bypass the bridge hold. Actual-function regression rejects inactive, malformed and rejected state; the positive case keeps the server's unpaid result despite a native local entitled flag. Before this final boundary fix that16-case foreground matrix produced15PASS/1FAIL; after it all16PASS. The combined accepted source set is33/33PASS,0skip. These App state calls are local native reads, not billed analysis.
