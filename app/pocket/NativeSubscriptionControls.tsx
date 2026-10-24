"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import AndroidSubscriptionControls from "./AndroidSubscriptionControls";
import {isGoogleNativeApp} from "./play-billing";
import WebSubscriptionControls from "./WebSubscriptionControls";
import { getAppleProductStatus, getAppleAccessStatus, isAppleNativeApp, purchaseAppleSubscription, restoreAppleSubscription, subscribeAppleAccessChanges, type AppleAccessStatus } from "./apple-storekit";
import { nativeSubscriptionView, type NativeSubscriptionPhase } from "./native-subscription-view";

// Capacitor platform identity is fixed for this app session. A null server
// snapshot keeps hydration consistent before the browser/native identity is read.
const subscribePlatform = () => () => {};
const serverPlatform = (): boolean | null => null;

export default function NativeSubscriptionControls() {
  const android = useSyncExternalStore<boolean | null>(subscribePlatform, isGoogleNativeApp, serverPlatform);
  const [status, setStatus] = useState<AppleAccessStatus | null>(null);
  const native = useSyncExternalStore<boolean | null>(subscribePlatform, isAppleNativeApp, serverPlatform);
  const [phase, setPhase] = useState<NativeSubscriptionPhase>("CHECKING");
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const actionRunning = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    if (native !== true) return;
    mounted.current = true;
    let active = true;
    const initial = ++revision.current;
    const invalidateRevision = () => { revision.current++; };
    const subscription = subscribeAppleAccessChanges((next, verification) => {
      if (!active) return;
      revision.current++;
      setStatus(verification === "VERIFIED" ? next : { ...next, entitled: false });
      setPhase(verification === "VERIFIED" ? "READY" : verification === "ERROR" ? "ERROR" : "CHECKING");
      setMessage(verification === "ERROR" ? "Apple subscription verification failed. Restore Purchases or retry the check. Contact support before purchasing again." : "");
    }).catch(error => {
      if (active) {
        revision.current++;
        setStatus(null); setPhase("ERROR");
        setMessage(error instanceof Error ? error.message : "Apple updates are unavailable. Restore Purchases or retry the check.");
      }
      return null;
    });
    void getAppleProductStatus().then(next => { if (!active || initial !== revision.current) return null; setStatus(next); return getAppleAccessStatus(); })
      .then(next => { if (next && active && initial === revision.current) { setStatus(next); setPhase("READY"); } })
      .catch(error => { if (active && initial === revision.current) { setPhase("ERROR"); setMessage(error instanceof Error ? error.message : "Apple access is unavailable. Restore Purchases or retry the check."); } });
    return () => { active = false; mounted.current = false; invalidateRevision(); void subscription.then(listener => listener?.remove()).catch(() => undefined); };
  }, [native, attempt]);
  const view = nativeSubscriptionView(status, phase);
  if (android === true) return <AndroidSubscriptionControls />;
  if (native === false) return <WebSubscriptionControls />;
  if (native === null) return <section className="psPreflight" aria-label="Subscription access"><p role="status">Checking subscription options…</p></section>;
  async function run(kind: "purchase" | "restore") {
    if (actionRunning.current || !mounted.current || (kind === "purchase" && !view.showPurchase)) return;
    actionRunning.current = true; setBusy(true); setMessage("");
    const current = ++revision.current;
    try {
      const next = kind === "purchase" ? await purchaseAppleSubscription() : await restoreAppleSubscription();
      if (!mounted.current || current !== revision.current) return;
      setStatus(next);
      setPhase("READY");
      setMessage(next.entitled ? "Your Apple subscription is verified for this Pocket account." : "Apple access could not be linked to this Pocket account. Existing purchases may need verified account linking. Contact support before purchasing again.");
    } catch (error) {
      if (mounted.current && current === revision.current) { setPhase("ERROR"); setMessage(error instanceof Error ? error.message : "Apple access could not be verified. Try Restore Purchases."); }
    } finally { actionRunning.current = false; if (mounted.current) setBusy(false); }
  }
  const retry = () => { if (actionRunning.current) return; revision.current++; setPhase("CHECKING"); setMessage(""); setAttempt(value => value + 1); };
  return <section className="psPreflight" aria-label="Apple subscription access" aria-busy={busy || phase === "CHECKING"}>
    <header><strong>{view.heading}</strong></header>
    {view.productLabel ? <p>{view.productLabel}</p> : <p role="status">{phase === "CHECKING" ? "Checking the Apple product and your Pocket account. You can restore an existing purchase below." : "Apple product or access verification is unavailable. Restore an existing purchase or retry; no purchase is offered while this check is unresolved."}</p>}
    <p>Sign in to your Pocket account to verify access. Subscriptions renew automatically until cancelled in your Apple Account settings.</p>
    <div><a href="/pocket/login">Sign in</a>{" · "}<a href="/terms">Terms</a>{" · "}<a href="/privacy">Privacy</a></div>
    {view.showPurchase ? <button type="button" disabled={busy} onClick={() => void run("purchase")}>Subscribe with Apple</button> : null}{" "}
    <button type="button" disabled={busy} onClick={() => void run("restore")}>{busy ? "Checking Apple…" : "Restore Purchases"}</button>
    {view.showRetry ? <button type="button" disabled={busy} onClick={retry}>Retry Apple check</button> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
