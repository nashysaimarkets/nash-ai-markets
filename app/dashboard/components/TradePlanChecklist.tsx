"use client";

import { useState } from "react";

const ITEMS = ["Live data is healthy", "Price is at a defined level", "Required confirmation is present", "Risk/reward is acceptable", "No major event is too close", "The setup is not invalidated", "The session is not a no-trade environment"];

export function TradePlanChecklist() {
  const [checked, setChecked] = useState<boolean[]>(() => ITEMS.map(() => false));
  const complete = checked.filter(Boolean).length;
  return <section className="tradePlanChecklist" aria-labelledby="trade-checklist-title">
    <header><div><span className="eliteEyebrow">PRIVATE IN-BROWSER WORKFLOW</span><h2 id="trade-checklist-title">Pre-trade decision checklist</h2><p>Nothing is sent to Bullseye or stored on the server.</p></div><strong>{complete}/{ITEMS.length} reviewed</strong></header>
    <div>{ITEMS.map((item, index) => <label key={item}><input type="checkbox" checked={checked[index]} onChange={() => setChecked((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span aria-hidden="true">{checked[index] ? "✓" : ""}</span>{item}</label>)}</div>
    <footer><button type="button" onClick={() => setChecked(ITEMS.map(() => false))}>Reset checklist</button><span>Checklist completion does not validate or recommend a trade.</span></footer>
  </section>;
}
