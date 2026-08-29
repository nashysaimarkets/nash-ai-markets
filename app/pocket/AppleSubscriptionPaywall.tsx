"use client";

import { useState } from "react";
import type { AppleAccessStatus } from "./apple-storekit";
import { purchaseAppleSubscription, restoreAppleSubscription } from "./apple-storekit";

export default function AppleSubscriptionPaywall({ status, onUnlocked, onClose }: { status: AppleAccessStatus; onUnlocked: (status: AppleAccessStatus) => void; onClose: () => void }) {
  const [action, setAction] = useState<"purchase" | "restore" | null>(null);
  const [message, setMessage] = useState("");

  async function run(kind: "purchase" | "restore") {
    setAction(kind);
    setMessage("");
    try {
      const next = kind === "purchase" ? await purchaseAppleSubscription() : await restoreAppleSubscription();
      if (!next.entitled) {
        setMessage(kind === "restore" ? "No active Pocket Bullseye subscription was found for this Apple Account." : "The purchase was not completed. You have not been charged.");
        return;
      }
      onUnlocked(next);
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "Apple could not complete that request.";
      setMessage(/cancel/i.test(text) ? "Purchase cancelled. You have not been charged." : text);
    } finally { setAction(null); }
  }

  return <section className="psApplePaywall" role="dialog" aria-modal="true" aria-label="Subscribe to Pocket Bullseye">
    <div className="psApplePaywallGlow" aria-hidden="true"><i/><i/><b>🎯</b></div>
    <button className="psApplePaywallClose" type="button" onClick={onClose} aria-label="Close subscription screen">×</button>
    <small>YOUR FREE ANALYSIS IS COMPLETE</small>
    <h2>Keep Bullseye<br/><em>in your pocket.</em></h2>
    <p>Unlock unlimited chart analysis, cinematic results and written decision support with a one-month auto-renewable subscription.</p>
    <div className="psApplePlan">
      <span>{status.displayName}</span>
      <strong>{status.displayPrice}<small>/ month</small></strong>
      <b>One month · cancel in your Apple Account settings</b>
    </div>
    <button className="psAppleSubscribe" type="button" disabled={action !== null} onClick={() => run("purchase")}>{action === "purchase" ? "CONNECTING TO APPLE…" : `SUBSCRIBE FOR ${status.displayPrice} / MONTH`}<b>→</b></button>
    <button className="psAppleRestore" type="button" disabled={action !== null} onClick={() => run("restore")}>{action === "restore" ? "CHECKING APPLE ACCOUNT…" : "RESTORE PURCHASES"}</button>
    {message ? <p className="psApplePaywallMessage" role="alert">{message}</p> : null}
    <footer>The displayed monthly price is charged to your Apple Account when you confirm. The one-month subscription renews automatically at the displayed price unless cancelled at least 24 hours before the end of the current period. Manage or cancel it in Apple Account settings, or use Restore Purchases above on another device. <a href="/terms" target="_blank" rel="noreferrer">Terms</a> · <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a></footer>
  </section>;
}
