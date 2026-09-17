"use client";

import { useEffect, useRef, useState } from "react";
import { pendingAppleAction, restoreAppleSubscription, type AppleAccessStatus } from "./apple-storekit";
import { appleActionErrorMessage, appleErrorDiagnostic, appleInactiveMessage, formatAppleErrorDiagnostic, type AppleErrorDiagnostic } from "./apple-purchase-flow";
import { trackGrowth } from "./growth-client";

/** Keep restoration reachable even when an active subscription hides the paywall. */
export default function AppleAccessControls({ status, onStatus }: { status: AppleAccessStatus | null; onStatus: (status: AppleAccessStatus) => void }) {
  const [restoring, setRestoring] = useState(false);
  const [slow, setSlow] = useState(false);
  const [message, setMessage] = useState("");
  const [diagnostic, setDiagnostic] = useState<AppleErrorDiagnostic | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (pendingAppleAction()?.kind === "restore") void restore();
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!restoring) { setSlow(false); return; }
    const timer = window.setTimeout(() => setSlow(true), 15_000);
    return () => window.clearTimeout(timer);
  }, [restoring]);

  async function restore() {
    if (running.current) return;
    running.current = true;
    setRestoring(true);
    setMessage("");
    setDiagnostic(null);
    try {
      const next = await restoreAppleSubscription();
      if (!mounted.current) return;
      if (!next.isNative) throw new Error("Open the iPhone app to restore Apple purchases.");
      onStatus(next);
      setMessage(next.entitled ? "Restore complete. Your subscription is active." : appleInactiveMessage("restore"));
      if (next.entitled) trackGrowth("restore_completed", { flow: "paid" });
    } catch (caught) {
      if (!mounted.current) return;
      setMessage(appleActionErrorMessage(caught, "restore"));
      setDiagnostic(appleErrorDiagnostic(caught));
    } finally {
      running.current = false;
      if (mounted.current) setRestoring(false);
    }
  }

  const accessLabel = !status ? "Checking access" : status.entitled ? "Subscription active" : status.freeUseConsumed ? "Free analysis used" : "One free analysis available";

  return <section className="psAppleAccount" aria-label="Apple subscription">
    <div className="psAppleAccountRow">
      <div><small>APPLE SUBSCRIPTION</small><strong>{accessLabel}</strong></div>
      <button type="button" disabled={restoring} onClick={() => void restore()}>{restoring ? "RESTORING…" : "RESTORE PURCHASES"}</button>
    </div>
    {status && !status.entitled && status.freeUseConsumed ? <p>Your free analysis has been used on this device. App updates do not renew it.</p> : null}
    {slow ? <p role="status">Apple is still checking. Complete any Apple sign-in prompt; another restore will not be started.</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {diagnostic ? <details className="psAppleErrorDetails"><summary>Apple error details · Restore</summary><pre>{formatAppleErrorDiagnostic(diagnostic)}</pre></details> : null}
  </section>;
}
