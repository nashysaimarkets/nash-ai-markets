"use client";

import { useEffect, useRef, useState } from "react";
import {
  purchaseNativeSubscription,
  restoreNativeSubscription,
  type NativeAccessStatus,
} from "./native-subscription";

export default function NativeSubscriptionPaywall({ status, onUnlocked, onClose }: { status: NativeAccessStatus; onUnlocked: (status: NativeAccessStatus) => void; onClose: () => void }) {
  const [action, setAction] = useState<"purchase" | "restore" | null>(null);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const isGoogle = status.store === "google";
  const storeName = isGoogle ? "Google Play" : "Apple";
  const accountName = isGoogle ? "Google Play account" : "Apple Account";
  const hasLocalisedPrice = !(isGoogle && status.displayPrice === "Google Play");
  const purchaseLabel = hasLocalisedPrice
    ? `SUBSCRIBE FOR ${status.displayPrice} / MONTH`
    : "CONTINUE TO GOOGLE PLAY";

  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const containFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (!dialog.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", containFocus);
    return () => document.removeEventListener("keydown", containFocus);
  }, []);

  async function run(kind: "purchase" | "restore") {
    setAction(kind);
    setMessage("");
    try {
      const next = kind === "purchase" ? await purchaseNativeSubscription() : await restoreNativeSubscription();
      if (next.pending) {
        setMessage(`Your ${storeName} purchase is pending. Access will unlock after payment is confirmed.`);
        return;
      }
      if (!next.entitled) {
        setMessage(kind === "restore" ? `No active Pocket Bullseye subscription was found for this ${accountName}.` : "The purchase was not completed. You have not been charged.");
        return;
      }
      onUnlocked(next);
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : `${storeName} could not complete that request.`;
      setMessage(/cancel/i.test(text) ? "Purchase cancelled. You have not been charged." : text);
    } finally { setAction(null); }
  }

  return <section ref={dialog} className="psApplePaywall" role="dialog" aria-modal="true" aria-label="Subscribe to Pocket Bullseye">
    <div className="psApplePaywallGlow" aria-hidden="true"><i/><i/><b>🎯</b></div>
    <button className="psApplePaywallClose" type="button" autoFocus onClick={onClose} aria-label="Close subscription screen">×</button>
    <small>YOUR FREE ANALYSIS IS COMPLETE</small>
    <h2>Keep Bullseye<br/><em>in your pocket.</em></h2>
    <p>Unlock unlimited chart analysis, cinematic results and written decision support with a one-month auto-renewing subscription.</p>
    <div className="psApplePlan">
      <span>{status.displayName}</span>
      <strong>{hasLocalisedPrice ? status.displayPrice : "LOCAL PRICE"}<small>{hasLocalisedPrice ? "/ month" : "shown by Google Play"}</small></strong>
      <b>One month · cancel in your {accountName} settings</b>
    </div>
    <button className="psAppleSubscribe" type="button" disabled={action !== null} onClick={() => run("purchase")}>{action === "purchase" ? `CONNECTING TO ${storeName.toUpperCase()}…` : purchaseLabel}<b>→</b></button>
    <button className="psAppleRestore" type="button" disabled={action !== null} onClick={() => run("restore")}>{action === "restore" ? `CHECKING ${accountName.toUpperCase()}…` : "RESTORE PURCHASES"}</button>
    {message ? <p className="psApplePaywallMessage" role="alert">{message}</p> : null}
    <footer>The displayed monthly price is charged to your {accountName} when you confirm. The subscription renews automatically each month at the displayed price unless cancelled before the end of the current billing period. Manage or cancel it in your {accountName} subscription settings, or use Restore Purchases above on another device. <a href="/terms" target="_blank" rel="noreferrer">Terms</a> · <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a></footer>
  </section>;
}
