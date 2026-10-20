"use client";
import { type ChangeEvent } from "react";
import { cryptoBase, isDerivativesResult, type DerivativesResult } from "./crypto-derivatives";
import { useScreenshotComparison } from "./use-screenshot-comparison";

export default function CryptoDerivativesCheck({ ticker, structure }: { ticker: string; structure: string }) {
  return <CryptoDerivativesSession key={JSON.stringify([ticker, structure])} ticker={ticker} structure={structure} />;
}

function CryptoDerivativesSession({ ticker, structure }: { ticker: string; structure: string }) {
  const base = cryptoBase(ticker);
  const { image, fileName, busy, reading, error, result, attach: attachScreenshot, check: checkScreenshot, cancel } = useScreenshotComparison<DerivativesResult>("/api/pocket/crypto-derivatives", "The panel check could not complete.", isDerivativesResult);
  if (!base) return null;

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    await attachScreenshot(file);
  }

  async function check() {
    await checkScreenshot({ ticker, structure });
  }

  return <section className="psOptionsWall" aria-live="polite" aria-busy={busy}>
    <header><div><span>◇ CRYPTO DERIVATIVES CHECK</span><small>OPTIONAL · {base} · SCREENSHOT EVIDENCE</small></div><b>{reading ? "OPENING…" : busy ? "READING…" : result ? "CHECK COMPLETE" : image ? "READY" : "ADD PANEL"}</b></header>
    <p>Upload a derivatives panel for the same crypto asset. Compare visible funding, open interest, positioning and liquidations with the chart structure.</p>
    <div className="psOptionsWallActions"><label>{image ? "CHANGE SCREENSHOT" : "＋ ADD PANEL SCREENSHOT"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Add crypto derivatives panel screenshot" onChange={attach} /></label><button type="button" onClick={check} disabled={!image || busy || reading}>{busy ? "CHECKING…" : "CHECK DERIVATIVES"}</button>{busy || reading ? <button type="button" onClick={cancel}>CANCEL CHECK</button> : null}</div>
    {image ? <small className="psOptionsWallFile">{fileName}</small> : null}
    {error ? <p role="alert" className="psOptionsWallError">{error}</p> : null}
    {result ? <div className="psOptionsWallResult" data-status={result.status}><strong>{result.status === "UNVERIFIED" ? "COMPARISON HELD" : "VISIBLE CONTEXT"}</strong><p>{result.message}</p>{result.observations.length ? <ul>{result.observations.map((item) => <li key={item}>{item}</li>)}</ul> : null}{result.conflict ? <p>{result.conflict}</p> : null}</div> : null}
    <footer>Venue, units and timing matter. A screenshot cannot verify live positioning or liquidation pressure. This context does not change the verdict, score or chart levels.</footer>
  </section>;
}
