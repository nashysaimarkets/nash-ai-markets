"use client";

import { useMemo, useState } from "react";
import { buildVerifiedLevels, numericLevelPrice, seedVerificationDrafts, type VerificationDraft, type VerificationLevel } from "./level-verification";

export default function LevelVerificationPanel({ currentPrice, anchors = [], levels, onApply }: {
  currentPrice?: string;
  anchors?: { price: number; y: number }[];
  levels: VerificationLevel[];
  onApply: (levels: VerificationLevel[]) => void;
}) {
  const seeded = useMemo(() => seedVerificationDrafts(levels), [levels]);
  const [drafts, setDrafts] = useState<VerificationDraft[]>(seeded);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const readableAnchors = anchors.filter((anchor) => Number.isFinite(anchor.price) && Number.isFinite(anchor.y));
  const update = (id: string, patch: Partial<VerificationDraft>) => {
    setSaved(false);
    setDrafts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  const add = (kind: VerificationDraft["kind"]) => {
    setSaved(false);
    setDrafts((current) => { setReviewIndex(current.length); return [...current, { id: `manual-${Date.now()}-${kind}`, kind, price: "", label: "User verified", status: "review" }]; });
  };
  const active = drafts[Math.min(reviewIndex, Math.max(0, drafts.length - 1))];
  const confirmActive = () => {
    if (!active) return;
    update(active.id, { status: "confirmed" });
    setReviewIndex((index) => Math.min(drafts.length - 1, index + 1));
  };
  const apply = () => {
    const accepted = buildVerifiedLevels(drafts, currentPrice, anchors);
    onApply(accepted);
    setDrafts((current) => current.map((item) => numericLevelPrice(item.price) === null || item.status === "rejected" ? item : { ...item, status: "confirmed" }));
    setSaved(true);
    try {
      localStorage.setItem("pocket-level-verification-last", JSON.stringify({ at: new Date().toISOString(), currentPrice, levels: accepted.map(({ kind, price }) => ({ kind, price })) }));
    } catch {}
  };

  return <section className="psLevelVerify" aria-label="Level verification mode">
    <header><div><span>✓ LEVEL VERIFICATION MODE</span><strong>AI FINDS · YOU CONFIRM</strong></div><small>Exact lines remain editable before they influence your map.</small></header>
    <div className="psLevelVerifyEvidence">
      <article><span>CURRENT PRICE</span><strong>{numericLevelPrice(currentPrice) === null ? "UNVERIFIED" : currentPrice}</strong></article>
      <article><span>PRICE SCALE</span><strong>{readableAnchors.length >= 2 ? `${readableAnchors.length} POINTS READ` : "NEEDS CHECK"}</strong></article>
      <article><span>STRUCTURES</span><strong>{drafts.filter((item) => item.status !== "rejected" && numericLevelPrice(item.price) !== null).length}</strong></article>
    </div>
    {active ? <div className="psLevelReviewStep"><header><span>LEVEL {reviewIndex + 1} OF {drafts.length}</span><strong>{drafts.filter((item) => item.status === "confirmed").length} CONFIRMED · {drafts.filter((item) => item.status === "rejected").length} REJECTED</strong></header><div className="psLevelVerifyRows"><article key={active.id} data-kind={active.kind} data-status={active.status}>
      <select aria-label="Level type" value={active.kind} onChange={(event) => update(active.id, { kind: event.target.value as VerificationDraft["kind"] })}><option value="support">SUPPORT</option><option value="resistance">RESISTANCE</option><option value="pivot">SWING REFERENCE</option></select>
      <input inputMode="decimal" aria-label={`${active.kind} price`} value={active.price} placeholder="ENTER PRICE" onChange={(event) => update(active.id, { price: event.target.value })} />
      <button type="button" data-active={active.status === "confirmed"} onClick={confirmActive}>{active.status === "confirmed" ? "✓ CONFIRMED" : "CONFIRM"}</button>
      <button type="button" data-reject onClick={() => update(active.id, { status: active.status === "rejected" ? "review" : "rejected" })}>{active.status === "rejected" ? "RESTORE" : "REJECT"}</button>
    </article></div><nav aria-label="Review detected levels"><button type="button" disabled={reviewIndex === 0} onClick={() => setReviewIndex((index) => Math.max(0, index - 1))}>← PREVIOUS</button><button type="button" disabled={reviewIndex >= drafts.length - 1} onClick={() => setReviewIndex((index) => Math.min(drafts.length - 1, index + 1))}>NEXT →</button></nav></div> : <p className="psLevelVerifyEmpty"><strong>NO EXACT LINE SURVIVED AUTOMATIC VERIFICATION.</strong><span>The readable evidence is still shown above. Add only a price you can personally confirm on the source chart.</span></p>}
    <div className="psLevelVerifyActions"><button type="button" onClick={() => add("support")}>＋ SUPPORT</button><button type="button" onClick={() => add("resistance")}>＋ RESISTANCE</button><button type="button" onClick={apply} disabled={!drafts.some((item) => item.status !== "rejected" && numericLevelPrice(item.price) !== null)}>{saved ? "✓ MAP UPDATED" : "APPLY VERIFIED LEVELS"}</button></div>
    <footer>Confirmed levels stay on this device and remain your responsibility. Bullseye does not place trades.</footer>
  </section>;
}
