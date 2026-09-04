"use client";

/* Uploaded charts are private data URLs and intentionally bypass next/image. */
/* eslint-disable @next/next/no-img-element */

import { useId, useMemo, useState, type SyntheticEvent } from "react";
import {
  parseLiquidityCurrentPrice,
  projectLiquidityPrice,
  projectLiquidityZones,
  type LiquidityPlotBounds,
  type LiquidityScaleAnchor,
  type LiquidityShield,
} from "./liquidity-guard";
import { canonicalizePocketGeometry } from "../lib/pocket-geometry";

type LiquidityGuardAnalysis = {
  currentPrice?: string;
  timeframe: string;
  evidenceQuality?: { chartReadability?: string; candlesReadable?: boolean };
  plotBounds?: LiquidityPlotBounds;
  priceScaleAnchors?: LiquidityScaleAnchor[];
  liquidityShield?: LiquidityShield;
};

type LiquidityGuardDisplayState = "locked" | "verified-none" | "withheld" | "unavailable";

const EMPTY_ANCHORS: LiquidityScaleAnchor[] = [];

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 6 }).format(value);
}

function zonePriceLabel(priceLow: number, priceHigh: number) {
  return priceLow === priceHigh ? formatPrice(priceLow) : `${formatPrice(priceLow)}–${formatPrice(priceHigh)}`;
}

function patternLabel(pattern: string) {
  return pattern.replaceAll("_", " ");
}

function sideLabel(side: "ABOVE_PRICE" | "AT_PRICE" | "BELOW_PRICE") {
  return side === "ABOVE_PRICE" ? "ABOVE CURRENT" : side === "BELOW_PRICE" ? "BELOW CURRENT" : "AT CURRENT PRICE";
}

export default function LiquidityGuardOverlay({ analysis, sourceImage, onRescan, rescanning = false }: { analysis: LiquidityGuardAnalysis; sourceImage: string; onRescan?: () => void; rescanning?: boolean }) {
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [landscape, setLandscape] = useState(false);
  const instanceId = useId().replaceAll(":", "");
  const headingId = `liquidity-guard-${instanceId}`;
  const aboveGradientId = `liquidity-above-${instanceId}`;
  const atGradientId = `liquidity-at-${instanceId}`;
  const belowGradientId = `liquidity-below-${instanceId}`;
  const geometry = useMemo(() => canonicalizePocketGeometry({
    plotBounds: analysis.plotBounds,
    priceScaleAnchors: analysis.priceScaleAnchors,
    liquidityShield: analysis.liquidityShield,
  }) as Pick<LiquidityGuardAnalysis, "plotBounds" | "priceScaleAnchors" | "liquidityShield">, [analysis.liquidityShield, analysis.plotBounds, analysis.priceScaleAnchors]);
  const anchors = geometry.priceScaleAnchors ?? EMPTY_ANCHORS;
  const plotBounds = geometry.plotBounds;
  const zones = useMemo(() => projectLiquidityZones(
    geometry.liquidityShield,
    analysis.currentPrice,
    anchors,
    plotBounds,
    analysis.evidenceQuality,
  ), [analysis.currentPrice, analysis.evidenceQuality, geometry.liquidityShield, plotBounds, anchors]);
  const currentPrice = parseLiquidityCurrentPrice(analysis.currentPrice);
  const currentY = currentPrice === null ? null : projectLiquidityPrice(currentPrice, anchors, plotBounds);
  const shield = geometry.liquidityShield;
  const displayState: LiquidityGuardDisplayState = zones.length
    ? "locked"
    : !shield
      ? "unavailable"
      : shield.status === "NO_VISIBLE_RISK_ZONES"
        ? "verified-none"
        : "withheld";
  const lockedSummary = shield?.summary || "Visible candle reactions align with the calibrated price rows.";
  const scaleEvidenceLabel = anchors.length >= 3 ? "THREE-LABEL SCALE CHECK" : anchors.length === 2 ? "TWO-LABEL SCALE CHECK" : "PRICE SCALE CHECK";
  const emptyState = displayState === "verified-none"
    ? {
        eyebrow: "SCAN COMPLETE",
        title: "NO CLEAR STOP-RISK CLUSTER",
        detail: "This chart does not show a defensible stop-risk cluster to mark. Nothing has been added to your chart.",
      }
    : displayState === "withheld"
      ? {
          eyebrow: "PROTECTION ACTIVE",
          title: "OVERLAY WITHHELD",
          detail: "Bullseye could not verify a stop-risk zone precisely enough, so it left your chart unmarked rather than guess.",
        }
      : {
          eyebrow: "SCAN NOT COMPLETED",
          title: "LIQUIDITY GUARD UNAVAILABLE",
          detail: "The stop-risk scan did not complete. Your chart remains unchanged; retry the analysis when ready.",
        };

  const recordAspect = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    setLandscape(image.naturalWidth / Math.max(1, image.naturalHeight) > 1.35);
  };

  return <section className="psLiquidityGuard" data-visible={overlayVisible} data-status={displayState} aria-labelledby={headingId}>
    <header>
      <div><span>◉ LIQUIDITY GUARD</span><h2 id={headingId}>VISUAL STOP-RISK MAP</h2><small>{scaleEvidenceLabel} · MULTIPLE CANDLE TOUCHES</small></div>
      {displayState === "locked" ? <button type="button" aria-pressed={overlayVisible} onClick={() => setOverlayVisible((visible) => !visible)}>{overlayVisible ? "HIDE OVERLAY" : "SHOW OVERLAY"}</button>
        : displayState !== "verified-none" && onRescan ? <button type="button" disabled={rescanning} onClick={onRescan}>{rescanning ? "REANALYSING…" : "REANALYSE CHART"}</button> : null}
    </header>
    {displayState !== "locked" ? <div className="psLiquidityStatus" data-state={displayState} role="status" aria-live="polite"><i aria-hidden="true">{displayState === "verified-none" ? "✓" : displayState === "withheld" ? "🛡" : "!"}</i><div><small>{emptyState.eyebrow}</small><strong>{emptyState.title}</strong><p>{emptyState.detail}</p></div><span>ORIGINAL CHART UNCHANGED</span></div> : null}
    <div className="psLiquidityCanvas" data-landscape={landscape}>
      <img src={sourceImage} alt="Uploaded trading chart" onLoad={recordAspect} />
      {overlayVisible && displayState === "locked" ? <>
        <svg className="psLiquidityVector" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={aboveGradientId} x1="0" x2="1"><stop offset="0" stopColor="#ff6277" stopOpacity=".08"/><stop offset=".58" stopColor="#ff6277" stopOpacity=".28"/><stop offset="1" stopColor="#ffb35a" stopOpacity=".08"/></linearGradient>
            <linearGradient id={atGradientId} x1="0" x2="1"><stop offset="0" stopColor="#ffc857" stopOpacity=".08"/><stop offset=".58" stopColor="#ffc857" stopOpacity=".32"/><stop offset="1" stopColor="#ff8f4d" stopOpacity=".08"/></linearGradient>
            <linearGradient id={belowGradientId} x1="0" x2="1"><stop offset="0" stopColor="#55d9ff" stopOpacity=".08"/><stop offset=".58" stopColor="#55d9ff" stopOpacity=".28"/><stop offset="1" stopColor="#8b7bff" stopOpacity=".08"/></linearGradient>
          </defs>
          {zones.map((zone, index) => <g key={`${zone.side}-${zone.pattern}-${zone.lineY}-${index}`} data-side={zone.side} data-confidence={zone.confidence}>
            <rect x={zone.left} y={zone.top} width={zone.right - zone.left} height={zone.height} rx=".5" fill={zone.side === "ABOVE_PRICE" ? `url(#${aboveGradientId})` : zone.side === "BELOW_PRICE" ? `url(#${belowGradientId})` : `url(#${atGradientId})`}/>
            <line x1={zone.left} y1={zone.lineY} x2={zone.right} y2={zone.lineY} vectorEffect="non-scaling-stroke"/>
            <path d={`M ${zone.left} ${zone.lineY - 1.5} V ${zone.lineY + 1.5} M ${zone.right} ${zone.lineY - 1.5} V ${zone.lineY + 1.5}`} vectorEffect="non-scaling-stroke"/>
            <g data-touch>{zone.touchPoints.map((point, pointIndex) => <circle key={`${point.x}-${point.y}-${pointIndex}`} cx={point.x} cy={point.y} r=".72" vectorEffect="non-scaling-stroke"/>)}</g>
          </g>)}
          {currentY !== null ? <g data-current><line x1={plotBounds?.left ?? 4} y1={currentY} x2={plotBounds?.right ?? 96} y2={currentY} vectorEffect="non-scaling-stroke"/></g> : null}
        </svg>
        <div className="psLiquidityLabels" aria-hidden="true">
          {zones.map((zone, index) => <span key={`${zone.label}-${zone.lineY}-${index}`} data-side={zone.side} data-confidence={zone.confidence} style={{ top: `clamp(34px, ${zone.lineY}%, calc(100% - 34px))`, left: `${Math.min(74, Math.max(3, zone.left + 1.5))}%` }}><i>{zone.side === "ABOVE_PRICE" ? "▲" : zone.side === "BELOW_PRICE" ? "▼" : "◆"}</i><b>{zone.label || patternLabel(zone.pattern)}</b><small>{zonePriceLabel(zone.priceLow, zone.priceHigh)} · {sideLabel(zone.side)}</small></span>)}
          {currentY !== null ? <em style={{ top: `clamp(22px, ${currentY}%, calc(100% - 22px))`, right: `${Math.max(2, 100 - (plotBounds?.right ?? 96))}%` }}>CURRENT · {analysis.currentPrice}</em> : null}
        </div>
      </> : null}
      {displayState === "locked" ? <div className="psLiquidityCorners" aria-hidden="true"><i/><i/><i/><i/></div> : null}
    </div>
    {displayState === "locked" ? <div className="psLiquidityIntel">
      <article><small>VISIBLE RISK MAP</small><strong>{`${zones.length} SCALE-CHECKED AREA${zones.length === 1 ? "" : "S"}`}</strong><p>{lockedSummary}</p></article>
      <ol aria-label="Visually inferred stop-risk areas">{zones.slice(0, 4).map((zone, index) => <li key={`${zone.pattern}-${index}`} data-side={zone.side}><i>{index + 1}</i><div><strong>{zone.label || patternLabel(zone.pattern)}</strong><span>{sideLabel(zone.side)} · {patternLabel(zone.pattern)} · {zonePriceLabel(zone.priceLow, zone.priceHigh)}</span></div><b>{zone.confidence}</b></li>)}</ol>
    </div> : null}
    <footer><div><span>🛡 STRUCTURAL GUIDANCE</span><p>{displayState === "locked" ? shield?.stopGuidance || "Keep invalidation structurally decisive and verify every marked area on the original chart." : displayState === "verified-none" ? "Keep using the invalidation defined by your setup; no separate stop-risk cluster was verified." : "Use the invalidation defined by your setup; Bullseye will not suggest a stop area without visible proof."}</p></div><small>MARKED AREAS ARE VISUALLY INFERRED STOP-RISK CANDIDATES. THEY ARE NOT GUARANTEED REVERSALS AND DO NOT VERIFY RESTING ORDERS. CHECK THE ORIGINAL PLATFORM.</small></footer>
  </section>;
}
