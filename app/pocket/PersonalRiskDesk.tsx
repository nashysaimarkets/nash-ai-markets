"use client";
import { useEffect, useState } from "react";
import { calculateRiskDesk, type RiskDeskInput } from "./pocket-risk-desk";
type RiskCurrency = "GBP" | "USD" | "EUR";
type StoredRiskDesk = RiskDeskInput & { currency: RiskCurrency; version: 1 };

const EMPTY_RISK_DESK: RiskDeskInput = { accountValue: "", riskPercent: "0.5", stopDistance: "", valuePerPoint: "" };

export default function PersonalRiskDesk() {
  const [input, setInput] = useState<RiskDeskInput>(EMPTY_RISK_DESK);
  const [currency, setCurrency] = useState<RiskCurrency>("GBP");
  const [status, setStatus] = useState("");
  const calculation = calculateRiskDesk(input);
  const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("pocket-risk-desk-v1") ?? "null") as StoredRiskDesk | null;
        if (!stored || stored.version !== 1) return;
        setInput({ accountValue: stored.accountValue, riskPercent: stored.riskPercent, stopDistance: stored.stopDistance, valuePerPoint: stored.valuePerPoint });
        if (["GBP", "USD", "EUR"].includes(stored.currency)) setCurrency(stored.currency);
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const update = (key: keyof RiskDeskInput, value: string) => setInput((current) => ({ ...current, [key]: value }));
  const save = () => {
    try {
      const stored: StoredRiskDesk = { ...input, currency, version: 1 };
      localStorage.setItem("pocket-risk-desk-v1", JSON.stringify(stored));
      setStatus("Saved privately on this device.");
    } catch { setStatus("This browser could not save your risk settings."); }
  };

  return <section className="psRiskDesk">
    <header><div><span>PERSONAL RISK DESK</span><small>YOUR LIMITS · YOUR DEVICE · NO ORDER CONNECTION</small></div><strong>{calculation.riskPercent !== null && calculation.riskPercent > 2 ? "HIGH LIMIT" : "PRIVATE"}</strong></header>
    <div className="psRiskDeskBody">
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <label><span>ACCOUNT VALUE</span><div><select aria-label="Account currency" value={currency} onChange={(event) => setCurrency(event.target.value as RiskCurrency)}><option value="GBP">GBP</option><option value="USD">USD</option><option value="EUR">EUR</option></select><input aria-label="Account value" inputMode="decimal" value={input.accountValue} onChange={(event) => update("accountValue", event.target.value)} placeholder="10,000" /></div></label>
        <label><span>MAX RISK PER IDEA</span><div><input aria-label="Maximum risk percent" inputMode="decimal" value={input.riskPercent} onChange={(event) => update("riskPercent", event.target.value)} placeholder="0.5" /><b>%</b></div></label>
        <label><span>STOP DISTANCE</span><div><input aria-label="Stop distance in points" inputMode="decimal" value={input.stopDistance} onChange={(event) => update("stopDistance", event.target.value)} placeholder="Optional" /><b>PTS</b></div></label>
        <label><span>VALUE PER POINT / UNIT</span><div><input aria-label="Value per point per unit" inputMode="decimal" value={input.valuePerPoint} onChange={(event) => update("valuePerPoint", event.target.value)} placeholder="Check broker" /><b>{currency}</b></div></label>
        <button type="submit">SAVE ON THIS DEVICE</button>
      </form>
      <div className="psRiskReadout" aria-live="polite">
        <article><small>MAX CASH RISK</small><strong>{money(calculation.cashRisk)}</strong><span>{calculation.riskPercent === null ? "Add account value and risk %" : `${calculation.riskPercent}% personal ceiling`}</span></article>
        <article><small>RISK PER UNIT</small><strong>{money(calculation.riskPerUnit)}</strong><span>Stop distance × value per point</span></article>
        <article data-primary><small>ILLUSTRATIVE MAX UNITS</small><strong>{calculation.units ?? "—"}</strong><span>{calculation.units === 0 ? "The stated unit risk exceeds your cash limit" : "Round down only · never up"}</span></article>
      </div>
    </div>
    {status ? <p className="psRiskStatus" role="status">{status}</p> : null}
    <footer><b>VERIFY CONTRACT SPECS</b><span>This calculator uses only the figures you enter. It does not know leverage, fees, slippage, margin or your broker’s contract size, and it does not place or recommend a trade.</span></footer>
  </section>;
}

