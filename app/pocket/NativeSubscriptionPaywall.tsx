"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  restoreNativeSubscription,
  type NativeAccessStatus,
} from "./native-subscription";

export default function NativeSubscriptionPaywall({ status, onClose }: { status: NativeAccessStatus; onUnlocked: (status: NativeAccessStatus) => void; onClose: () => void }) {
  const [action, setAction] = useState<"restore" | null>(null);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const isGoogle = status.store === "google";
  const storeName = isGoogle ? "Google Play" : status.store === "apple" ? "Apple" : "Pocket";
  const accountName = isGoogle ? "Google Play account" : status.store === "apple" ? "Apple Account" : "Pocket account";

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

  async function restore() {
    if (action !== null) return;
    setAction("restore"); setMessage("");
    try {
      const next = await restoreNativeSubscription();
      setMessage(next.pending
        ? "The store reports a pending purchase. Current-account verification is still required; no scanner access was granted."
        : "Restore was checked. Store information alone cannot verify this Pocket account. Contact support before purchasing again.");
      // Deliberately no onUnlocked: this branch has no current-account verifier.
    } catch {
      setMessage("Restore could not be checked. Retry shortly or contact support; no scanner access was granted.");
    } finally { setAction(null); }
  }

  if (typeof document === "undefined") return null;

  // .psApp intentionally uses CSS perspective for the scanner's depth effects.
  // In WKWebView that makes fixed descendants use the full, scrolled app as
  // their containing block. Portal the paywall to body so inset: 0 always
  // covers the visible iPhone viewport, even when it opens far down the page.
  return createPortal(<section ref={dialog} className="psApplePaywall" role="dialog" aria-modal="true" aria-label="Pocket subscription verification">
    <button className="psApplePaywallClose" type="button" autoFocus onClick={onClose} aria-label="Close subscription screen">×</button>
    <small>ACCOUNT VERIFICATION REQUIRED</small>
    <h2>Subscription verification is held.</h2>
    <p>This candidate cannot verify current-account subscription ownership. New purchases and free analysis are unavailable here. Existing store information cannot unlock a scanner.</p>
    <p>{status.displayName} · {storeName} recovery only</p>
    <button className="psAppleRestore" type="button" disabled={action !== null} onClick={() => void restore()}>{action === "restore" ? "CHECKING EXISTING PURCHASES…" : "RESTORE PURCHASES"}</button>
    <a href="/login?next=/pocket">Sign in to Pocket</a>{" · "}<a href="mailto:hello@nashaimarkets.com">Contact support</a>
    {message ? <p className="psApplePaywallMessage" role="alert">{message}</p> : null}
    <footer>Manage an existing subscription in your {accountName} settings. Restore does not start a new purchase. <a href="/terms" target="_blank" rel="noreferrer">Terms</a> · <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a></footer>
  </section>, document.body);
}

