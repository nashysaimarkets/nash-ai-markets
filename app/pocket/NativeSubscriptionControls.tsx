"use client";
import { useEffect, useRef, useState } from "react";
import { getAppleProductStatus, getAppleAccessStatus, isAppleNativeApp, purchaseAppleSubscription, restoreAppleSubscription, type AppleAccessStatus } from "./apple-storekit";

export default function NativeSubscriptionControls() {
  const [status, setStatus] = useState<AppleAccessStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const actionRunning = useRef(false);
  useEffect(() => {
    if (!isAppleNativeApp()) return;
    let active = true;
    void getAppleProductStatus().then(next => { if (active) setStatus(next); return getAppleAccessStatus(); })
      .then(next => { if (active) setStatus(next); })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Apple access is unavailable."); });
    return () => { active = false; };
  }, []);
  if (!status) return null;
  async function run(kind: "purchase" | "restore") {
    if (actionRunning.current) return;
    actionRunning.current = true; setBusy(true); setMessage("");
    try {
      const next = kind === "purchase" ? await purchaseAppleSubscription() : await restoreAppleSubscription();
      setStatus(next);
      setMessage(next.entitled ? "Your Apple subscription is verified for this Pocket account." : "Apple access could not be linked to this Pocket account. Existing purchases may need verified account linking. Contact support before purchasing again.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Apple access could not be verified. Try Restore Purchases.");
    } finally { actionRunning.current = false; setBusy(false); }
  }
  return <section className="psPreflight" aria-label="Apple subscription access">
    <header><strong>{status.entitled ? "APPLE ACCESS VERIFIED" : "APPLE SUBSCRIPTION"}</strong></header>
    <p>{status.displayName}{status.displayPrice ? ` · ${status.displayPrice} per month` : " · price unavailable"}</p>
    <p>Sign in to your Pocket account to verify access. Subscriptions renew automatically until cancelled in your Apple Account settings.</p>
    <div><a href="/login">Sign in</a>{" · "}<a href="/terms">Terms</a>{" · "}<a href="/privacy">Privacy</a></div>
    <button type="button" disabled={busy || status.entitled || !status.productAvailable || !status.displayPrice} onClick={() => void run("purchase")}>Subscribe with Apple</button>{" "}
    <button type="button" disabled={busy} onClick={() => void run("restore")}>{busy ? "Checking Apple…" : "Restore Purchases"}</button>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
