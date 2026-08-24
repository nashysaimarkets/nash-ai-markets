"use client";

import { useMemo, useState } from "react";

type Level = { kind: "support" | "resistance" | "trend" | "pivot" | "zone" | "gap"; label: string; price: string; x: number; y: number; x2: number; y2: number };
type Draft = { id: string; kind: "support" | "resistance" | "pivot"; price: string; label: string; status: "review" | "confirmed" | "rejected" };

function numeric(value: string | undefined) {
  const parsed = Number(value?.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function seedDrafts(levels: Level[]): Draft[] {
  return levels.flatMap((level, index) => numeric(level.price) === null || !["support", "resistance", "pivot"].includes(level.kind)
    ? []
    : [{ id: `detected-${index}`, kind: level.kind as Draft["kind"], price: level.price, label: level.label || "Detected level", status: "review" as const }]);
}

export default function LevelVerificationPanel({ currentPrice, anchors = [], levels, onApply }: {
  currentPrice?: string;
  anchors?: { price: number; y: number }[];
  levels: Level[];
  onApply: (levels: Level[]) => void;
}) {
  const seeded = useMemo(() => seedDrafts(levels), [levels]);
  const [drafts, setDrafts] = useState<Draft[]>(seeded);
  const [saved, setSaved] = useState(false);
  const readableAnchors = anchors.filter((anchor) => Number.isFinite(anchor.price) && Number.isFinite(anchor.y));
  const update = (id: string, patch: Partial<Draft>) => {
    setSaved(false);
    setDrafts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  const add = (kind: Draft["kind"]) => {
    setSaved(false);
    setDrafts((current) => [...current, { id: `manual-${Date.now()}-${kind}`, kind, price: "", label: "User verified", status: "review" }]);
  };
  const apply = () => {
    const accepted = drafts.flatMap((item) => {
      const price = numeric(item.price);
      if (item.status === "rejected" || price === null) return [];
      return [{ kind: item.kind, label: item.status === "confirmed" ? "User confirmed" : item.label, price: String(price), x: 0, y: 50, x2: 100, y2: 50 } satisfies Level];
    });
    onApply(accepted);
    setDrafts((current) => current.map((item) => numeric(item.price) === null || item.status === "rejected" ? item : { ...item, status: "confirmed" }));
    setSaved(true);
    try {
      localStorage.setItem("pocket-level-verification-last", JSON.stringify({ at: new Date().toISOString(), currentPrice, levels: accepted.map(({ kind, price }) => ({ kind, price })) }));
    } catch {}
  };

  return <section className="psLevelVerify" aria-label="Level verification mode">
    <header><div><span>✓ LEVEL VERIFICATION MODE</span><strong>AI FINDS · YOU CONFIRM</strong></div><small>Exact lines remain editable before they influence your map.</small></header>
    <div className="psLevelVerifyEvidence">
      <article><span>CURRENT PRICE</span><strong>{numeric(currentPrice) === null ? "UNVERIFIED" : currentPrice}</strong></article>
      <article><span>PRICE SCALE</span><strong>{readableAnchors.length >= 2 ? `${readableAnchors.length} POINTS READ` : "NEEDS CHECK"}</strong></article>
      <article><span>STRUCTURES</span><strong>{drafts.filter((item) => item.status !== "rejected" && numeric(item.price) !== null).length}</strong></article>
    </div>
    {drafts.length ? <div className="psLevelVerifyRows">{drafts.map((item) => <article key={item.id} data-kind={item.kind} data-status={item.status}>
      <select aria-label="Level type" value={item.kind} onChange={(event) => update(item.id, { kind: event.target.value as Draft["kind"] })}><option value="support">SUPPORT</option><option value="resistance">RESISTANCE</option><option value="pivot">PIVOT</option></select>
      <input inputMode="decimal" aria-label={`${item.kind} price`} value={item.price} placeholder="ENTER PRICE" onChange={(event) => update(item.id, { price: event.target.value })} />
      <button type="button" data-active={item.status === "confirmed"} onClick={() => update(item.id, { status: "confirmed" })}>CONFIRM</button>
      <button type="button" data-reject onClick={() => update(item.id, { status: item.status === "rejected" ? "review" : "rejected" })}>{item.status === "rejected" ? "RESTORE" : "REJECT"}</button>
    </article>)}</div> : <p className="psLevelVerifyEmpty"><strong>NO EXACT LINE SURVIVED AUTOMATIC VERIFICATION.</strong><span>The readable evidence is still shown above. Add only a price you can personally confirm on the source chart.</span></p>}
    <div className="psLevelVerifyActions"><button type="button" onClick={() => add("support")}>＋ SUPPORT</button><button type="button" onClick={() => add("resistance")}>＋ RESISTANCE</button><button type="button" onClick={apply} disabled={!drafts.some((item) => item.status !== "rejected" && numeric(item.price) !== null)}>{saved ? "✓ MAP UPDATED" : "APPLY VERIFIED LEVELS"}</button></div>
    <footer>Confirmed levels stay on this device and remain your responsibility. Bullseye does not place trades.</footer>
  </section>;
}
