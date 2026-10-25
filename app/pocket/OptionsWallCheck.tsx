"use client";
import { POCKET_PRODUCT } from "../lib/product-brand.ts";
import { type ChangeEvent } from "react";
import { isOptionsWallResult, type OptionsWallResult } from "./options-wall";
import { exactAxisPrice } from "./axis-verification";
import { useScreenshotComparison } from "./use-screenshot-comparison";

export default function OptionsWallCheck({ ticker, levels }: { ticker: string; levels: { kind: string; price: string; label: string }[] }) {
  // A recalibrated report is a new comparison even when the primary image is unchanged.
  return <OptionsWallSession key={JSON.stringify([ticker, levels])} ticker={ticker} levels={levels} />;
}

function OptionsWallSession({ ticker, levels }: { ticker: string; levels: { kind: string; price: string; label: string }[] }) {
  const readyForComparison = ticker !== "UNKNOWN" && Boolean(ticker.trim()) && levels.some((level) => ["support", "resistance", "pivot"].includes(level.kind) && exactAxisPrice(level.price) !== null);
  const { image, fileName, busy, reading, error, result, attach: attachScreenshot, check: checkScreenshot, cancel } = useScreenshotComparison<OptionsWallResult>("/api/pocket/options-wall", "The options check could not complete.", isOptionsWallResult);

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    await attachScreenshot(file);
  }

  async function check() {
    if (!readyForComparison) return;
    await checkScreenshot({ ticker, levels: levels.map(({ kind, price, label }) => ({ kind, price, label })) });
  }

  return <section className="psOptionsWall" aria-live="polite" aria-busy={busy}>
    <header><div><span>◉ OPTIONS WALL CROSS-CHECK</span><small>OPTIONAL · SCREENSHOT EVIDENCE</small></div><b>{reading ? "OPENING…" : busy ? "READING…" : result?.status === "MATCHED" ? "OVERLAP FOUND" : result ? "CHECK COMPLETE" : image ? "READY" : "ADD PROFILE"}</b></header>
    <p>Add an options <strong>volume-by-strike</strong> screenshot for the same listed symbol. {POCKET_PRODUCT.shortName} checks whether visible volume concentrations sit near verified price levels.</p>
    {!readyForComparison ? <p className="psOptionsWallNotice">Available when the chart has a confirmed listed ticker and a verified numeric price level.</p> : <div className="psOptionsWallActions"><label>{image ? "CHANGE SCREENSHOT" : "＋ ADD OPTIONS SCREENSHOT"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Add options volume profile screenshot" onChange={attach} /></label><button type="button" onClick={check} disabled={!image || busy || reading}>{busy ? "CHECKING…" : "CHECK OPTIONS WALL"}</button>{busy || reading ? <button type="button" onClick={cancel}>CANCEL CHECK</button> : null}</div>}
    {image ? <small className="psOptionsWallFile">{fileName}</small> : null}
    {error ? <p role="alert" className="psOptionsWallError">{error}</p> : null}
    {result ? <div className="psOptionsWallResult" data-status={result.status}><strong>{result.status === "UNVERIFIED" ? "COMPARISON HELD" : result.status === "MATCHED" ? "VISIBLE OVERLAP" : "NO VERIFIED OVERLAP"}</strong><p>{result.message}</p>{result.matches.length ? <ul>{result.matches.map((match, index) => <li key={`${match.expiry}-${match.side}-${match.strike}-${index}`}><b>{match.side} {match.strike}</b><span>{match.volume.toLocaleString()} traded · {match.expiry} · near {match.level.kind} {match.level.price}</span></li>)}</ul> : null}</div> : null}
    <footer>Volume is activity, not proof of positioning or direction. This check does not change your verdict, score or chart levels.</footer>
  </section>;
}
