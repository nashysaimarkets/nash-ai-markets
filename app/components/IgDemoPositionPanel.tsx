"use client";

import { useEffect, useState } from "react";
import { IG_DEMO_PANEL_ENABLED_BY_DEFAULT } from "../lib/ig-demo-panel";
import type { IgDemoPanelSnapshot } from "../lib/ig-demo-panel";

type Props = Readonly<{
  enabled?: boolean;
  snapshot: IgDemoPanelSnapshot | null;
  busy?: boolean;
  message?: "UNAVAILABLE" | "EXPIRED" | "RATE_LIMITED" | "CANCELLED";
  onConnect?: () => void;
  onRefresh?: () => void;
  onDisconnect?: () => void;
}>;

const messages = {
  UNAVAILABLE: "DEMO account information is unavailable. Your existing data has been cleared.",
  EXPIRED: "Your DEMO connection expired. Connect again to view current positions.",
  RATE_LIMITED: "IG's request limit was reached. Wait before refreshing.",
  CANCELLED: "The DEMO request was cancelled.",
} as const;

/** Unmounted optional view. Server supplies redacted DTOs; browser never handles IG login. */
export default function IgDemoPositionPanel({
  enabled = IG_DEMO_PANEL_ENABLED_BY_DEFAULT, snapshot, busy = false, message,
  onConnect, onRefresh, onDisconnect,
}: Props) {
  const [observedClock, setObservedClock] = useState(() => Date.now());
  useEffect(() => {
    const deadline = snapshot ? Date.parse(snapshot.expiresAt) : Number.NaN;
    if (!Number.isFinite(deadline)) return;
    const timer = setTimeout(() => setObservedClock(Date.now()), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [snapshot]);
  if (!enabled) return null;
  // Caller must clear snapshots on request failure, expiry, logout or reconnect.
  const expired = snapshot && (!Number.isFinite(Date.parse(snapshot.expiresAt)) || Date.parse(snapshot.expiresAt) <= observedClock);
  const view = message || busy || expired ? null : snapshot;
  return (
    <section aria-label="IG DEMO connection" className="rounded-2xl border border-[#b9a87a]/30 bg-[#131a24] p-4 text-[#f2efe7]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">IG account <span className="rounded border border-[#b9a87a]/60 px-2 py-0.5 text-xs text-[#e6d9b5]">DEMO</span></h2>
        <a href="https://www.ig.com/uk" target="_blank" rel="noopener noreferrer" className="min-h-11 rounded px-2 py-3 text-sm underline focus-visible:outline focus-visible:outline-2">Return to IG</a>
      </header>
      <p className="mt-2 text-sm text-[#c6cbd1]">Read-only demonstration account. Position values are account records, with no current quotes or trading controls.</p>
      <div role="status" aria-live="polite" aria-atomic="true" className="mt-3 text-sm">
        {busy ? "Checking your DEMO account…" : message ? messages[message] : expired ? messages.EXPIRED : view ? `Observed ${view.observedAt}` : "No DEMO account connected."}
      </div>
      {view && <>
        <p className="mt-3 break-all text-sm">Account {view.account.accountId} · {view.account.accountType} · {view.account.currency}</p>
        {view.positions.length === 0 ? <p className="mt-3 text-sm">No open positions were returned for this DEMO account.</p> : (
          <ul className="mt-3 space-y-3" aria-label="Open DEMO positions">
            {view.positions.map((position) => (
              <li key={position.dealId} className="rounded-xl border border-white/15 p-3 text-sm">
                <p className="break-all font-medium">{position.epic}</p>
                <p className="mt-1">{position.direction} · Size {position.size} · Open level {position.openLevel}</p>
                <p className="mt-1 text-xs text-[#c6cbd1]">Position currency {position.currency}</p>
                <p className="mt-1 break-all text-xs text-[#c6cbd1]">Deal {position.dealId}</p>
                <p className="mt-2 text-xs text-[#e6d9b5]">{position.chartContext === "EXACT_IG_PRODUCT" ? "Exact IG DEMO product matches the confirmed chart." : position.chartContext === "HOLD_DIFFERENT_PRODUCT" ? "Chart product differs. Position context is on hold." : "Confirm the chart's exact IG DEMO product before comparing."}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-[#c6cbd1]">Risk comparison is on hold until authoritative market specifications are verified. IG CFDs and spread bets are different products from cash SPX and ES futures.</p>
      </>}
      <div className="mt-4 flex flex-wrap gap-2">
        {snapshot ? <>
          {expired || message === "EXPIRED" || message === "UNAVAILABLE" ?
            <button type="button" disabled={busy || !onConnect} onClick={onConnect} className="min-h-11 rounded-lg border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Reconnect IG DEMO account</button> :
            <button type="button" disabled={busy || !onRefresh} onClick={onRefresh} className="min-h-11 rounded-lg border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Refresh DEMO</button>}
          <button type="button" disabled={!onDisconnect} onClick={onDisconnect} className="min-h-11 rounded-lg border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Disconnect DEMO</button>
        </> : <button type="button" disabled={busy || !onConnect} onClick={onConnect} className="min-h-11 rounded-lg border border-[#b9a87a]/70 px-4 py-2 text-sm disabled:opacity-50">Connect existing IG DEMO account</button>}
      </div>
    </section>
  );
}
