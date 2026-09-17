"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PocketGlyph } from "./PocketDepthMark";
import type { AppleAccessStatus } from "./apple-storekit";
import { getAppleAccessStatus, pendingAppleAction, purchaseAppleSubscription, restoreAppleSubscription } from "./apple-storekit";
import { appleActionErrorMessage, appleErrorDiagnostic, appleInactiveMessage, formatAppleErrorDiagnostic, type AppleErrorDiagnostic } from "./apple-purchase-flow";
import { withDeadline } from "./async-deadline";
import { trackGrowth } from "./growth-client";
import { UsageControl } from "./GrowthControls";

export default function AppleSubscriptionPaywall({ status, onUnlocked, onClose }: { status: AppleAccessStatus; onUnlocked: (status: AppleAccessStatus) => void; onClose: () => void }) {
  const actionRunning = useRef(false);
  const viewCounted = useRef(false);
  useEffect(() => {
    if (viewCounted.current) return;
    viewCounted.current = true;
    trackGrowth("paywall_viewed", { flow: "paid" });
  }, []);
  const [action, setAction] = useState<"purchase" | "restore" | null>(null);
  const [message, setMessage] = useState("");
  const [errorDiagnostic, setErrorDiagnostic] = useState<AppleErrorDiagnostic | null>(null);
  const [slow, setSlow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const mounted = useRef(true);
  const messageBox = useRef<HTMLParagraphElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);

  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    mounted.current = true;
    const pending = pendingAppleAction();
    if (pending) void run(pending.kind);
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!action) { setSlow(false); return; }
    const timer = window.setTimeout(() => setSlow(true), 15_000);
    return () => window.clearTimeout(timer);
  }, [action]);
  useEffect(() => {
    if (message) messageBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [message]);

  async function checkAccess() {
    if (checking) return;
    setChecking(true);
    setErrorDiagnostic(null);
    try {
      const next = await withDeadline(() => getAppleAccessStatus(), 10_000, "Apple has not returned your access status yet. Close this screen and try again when your connection is available.");
      if (!mounted.current) return;
      if (!next.isNative) throw new Error("Open the iPhone app to check Apple purchases.");
      setCurrentStatus(next);
      if (next.entitled) { onUnlocked(next); return; }
      setMessage(pendingAppleAction() ? "Apple is still handling your request. No active subscription is confirmed yet. You can close this screen and return; another purchase will not be started." : appleInactiveMessage("restore"));
    } catch (caught) {
      if (mounted.current) setMessage(appleActionErrorMessage(caught, "restore"));
    } finally { if (mounted.current) setChecking(false); }
  }

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
    if (actionRunning.current) return;
    actionRunning.current = true;
    if (kind === "purchase") trackGrowth("purchase_started", { flow: "paid" });
    setAction(kind);
    setMessage("");
    setErrorDiagnostic(null);
    try {
      const next = kind === "purchase" ? await purchaseAppleSubscription() : await restoreAppleSubscription();
      if (!mounted.current) return;
      setCurrentStatus(next);
      if (!next.entitled) {
        if (kind === "purchase") trackGrowth("purchase_incomplete", { flow: "paid" });
        setMessage(appleInactiveMessage(kind));
        return;
      }
      trackGrowth(kind === "purchase" ? "purchase_completed" : "restore_completed", { flow: "paid" });
      onUnlocked(next);
    } catch (caught) {
      if (!mounted.current) return;
      const text = appleActionErrorMessage(caught, kind);
      setErrorDiagnostic(appleErrorDiagnostic(caught));
      if (kind === "purchase") trackGrowth(/cancel/i.test(text) ? "purchase_incomplete" : "purchase_failed", { flow: "paid" });
      setMessage(text);
    } finally { actionRunning.current = false; if (mounted.current) setAction(null); }
  }

  if (typeof document === "undefined") return null;

  // Keep the sheet outside the app stacking context so it always covers the
  // visible iPhone viewport, even when opened far down a dimensional result.
  return createPortal(<section ref={dialog} className="psApplePaywall" role="dialog" aria-modal="true" aria-label="Subscribe to Pocket Bullseye">
    <div className="psApplePaywallGlow" aria-hidden="true"><i/><i/><b><PocketGlyph /></b></div>
    <button className="psApplePaywallClose" type="button" autoFocus onClick={onClose} aria-label="Close subscription screen">×</button>
    <small>YOUR FREE ANALYSIS IS COMPLETE</small>
    <h2>Keep Bullseye<br/><em>in your pocket.</em></h2>
    <p>Continue with chart analysis, cinematic results and written decision support with a one-month auto-renewable subscription.</p>
    <div className="psApplePlan">
      <span>{currentStatus.displayName}</span>
      <strong>{currentStatus.displayPrice || "Price unavailable"}{currentStatus.displayPrice ? <small>/ month</small> : null}</strong>
      <b>One month · cancel in your Apple Account settings</b>
      {currentStatus.currencyCode ? <small>Price supplied by Apple · {currentStatus.currencyCode}</small> : null}
    </div>
    {currentStatus.isSandbox ? <p className="psAppleTestNotice">Apple test environment · test purchases do not charge money.</p> : null}
    {message ? <p ref={messageBox} className="psApplePaywallMessage" role="alert">{message}</p> : null}
    {errorDiagnostic ? <details className="psAppleErrorDetails">
      <summary>Apple error details · {errorDiagnostic.operation === "purchase" ? "Subscribe" : "Restore"}</summary>
      <pre>{formatAppleErrorDiagnostic(errorDiagnostic)}</pre>
    </details> : null}
    {slow ? <p className="psApplePaywallMessage" role="status">Apple is taking longer than usual. Complete any Apple prompt, or check your access below. You can close this screen while the request finishes.</p> : null}
    <button className="psAppleSubscribe" type="button" disabled={action !== null || checking} onClick={() => run("purchase")}>{action === "purchase" ? "CONNECTING TO APPLE…" : currentStatus.displayPrice ? `SUBSCRIBE FOR ${currentStatus.displayPrice} / MONTH` : "CHECK PRICE WITH APPLE"}<b>→</b></button>
    <button className="psAppleRestore" type="button" disabled={action !== null} onClick={() => run("restore")}>{action === "restore" ? "CHECKING APPLE ACCOUNT…" : "RESTORE PURCHASES"}</button>
    {slow || message ? <button className="psAppleRestore" type="button" disabled={checking} onClick={() => void checkAccess()}>{checking ? "REFRESHING ACCESS…" : "CHECK APPLE ACCESS"}</button> : null}
    <UsageControl />
    <footer>Apple provides your local price and currency. Confirm the price on Apple's purchase sheet. The one-month subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel it in Apple Account settings, or use Restore Purchases above on another device. <a href="/terms" target="_blank" rel="noreferrer">Terms</a> · <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a></footer>
  </section>, document.body);
}
