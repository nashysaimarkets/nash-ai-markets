"use client";
import { POCKET_PRODUCT } from "../lib/product-brand";
import {createPrecisionReadingCrop as precisionCrop} from "../pocket/precision-reading-crop";
/* Private uploads and synthetic inline demos stay local; next/image provides no benefit. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import type { DeviceLocalScan, DevicePlotBounds } from "./device-geometry";
import ChartPreflightPanel from "../pocket/ChartPreflightPanel";
import IgDemoWorkspace from "../components/IgDemoWorkspace";
import {igDemoChartToken,type IgDemoChartBinding} from "../lib/ig-demo-chart-binding";
import NativeSubscriptionControls from "../pocket/NativeSubscriptionControls";
import PersonalRiskDesk from "../pocket/PersonalRiskDesk";
import PocketWorkflowDesk from "./PocketWorkflowDesk";
import type { VerifiedMacroContext } from "../lib/macro-data";
import OptionsWallCheck from "../pocket/OptionsWallCheck";
import CryptoDerivativesCheck from "../pocket/CryptoDerivativesCheck";
import OriginalChartEvidence from "../pocket/OriginalChartEvidence";
import ScannerClaimStatus from "../pocket/ScannerClaimStatus";
import {prepareScannerReport, UNVERIFIED_SCANNER_NOTICE} from "../pocket/scanner-claims";
import {useOriginalChartMeasurement} from "../pocket/use-original-chart-measurement";
import { preflightAllowsAnalysis, type ChartConfirmation, type PreflightStatus } from "../pocket/chart-preflight";
import { createChartRequestEpoch } from "../pocket/chart-request-identity";
import { pocketAuthenticatedFetch } from "../pocket/apple-storekit";
import { acceptWorkspaceReport, CHART_SLOT_HINTS, readWorkspaceImage, sameWorkspaceFacts, updateWorkspaceConfirmation, updateWorkspacePreflight, workspaceContext, workspaceSlotLabel, workspaceSlotTimeframe, type WorkspaceSource } from "./workspace-state";

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type Intention = "LONG" | "SHORT" | "UNSURE";
type Tab = "overview" | "levels" | "structure" | "patterns" | "liquidity" | "risk";
type Level = { kind: "support" | "resistance" | "trend" | "pivot" | "zone" | "gap"; label: string; price: string; x: number; y: number; x2: number; y2: number };
type Pattern = { name: string; status: "FORMING" | "CONFIRMED" | "FAILED" | "AMBIGUOUS" | "EXTENDED"; confidence?: "LOW" | "MEDIUM" | "HIGH"; evidence: string; confirmation?: string; invalidation: string; geometry?: { points: { x: number; y: number }[]; labelX: number; labelY: number } };
type LiquidityZone = { side: "BUY_SIDE" | "SELL_SIDE"; basis: "EQUAL_HIGHS" | "EQUAL_LOWS" | "PRIOR_SWING_HIGH" | "PRIOR_SWING_LOW" | "RANGE_HIGH" | "RANGE_LOW"; price: string; x: number; x2: number; y: number };
type LiquidityRead = { observations?: {side:string;x:number;y:number;confidence:string}[]; state: "VERIFIED" | "PARTIAL" | "NONE"; event: "NONE" | "TESTING" | "SWEEP" | "RECLAIM" | "REJECTION"; confidence: "LOW" | "MEDIUM" | "HIGH"; evidence: string; confirmation: string; invalidation: string; zones: LiquidityZone[] };
type Analysis = {
  direction: Direction;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  instrument: string;
  ticker: string;
  timeframe: string;
  currentPrice?: string;
  evidenceQuality: {
    chartReadability: "CLEAR" | "PARTIAL" | "POOR";
    instrumentConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    timeframeConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    scaleReadable: boolean;
    candlesReadable: boolean;
    limitations: string[];
  };
  higherTimeframe: { provided: boolean; timeframe: string; direction: Direction | "UNKNOWN"; alignment: "ALIGNED" | "CONFLICTING" | "MIXED" | "NOT_PROVIDED"; summary: string };
  patterns: Pattern[];
  liquidity?: LiquidityRead;
  nextSequence: { now: string; confirmation: string; failure: string; patience: string; reassess: string };
  summary: string;
  verdict: "WATCH" | "WAIT" | "STAND_ASIDE" | "REVIEW_REQUIRED";
  verdictHeadline: string;
  setupScore: { overall: number; grade: "A" | "B" | "C" | "D" | "F"; structure: number; momentum: number; location: number; confirmation: number; riskClarity: number; eventSafety: number };
  whatYouMayBeMissing: string[];
  improvesSetup: string[];
  killsSetup: string[];
  traderTrap: string;
  bullishCase: string;
  bearishCase: string;
  invalidation: string;
  marketStructure: string;
  levelStory: string;
  momentum: string;
  bullConfirmation: string;
  bearConfirmation: string;
  noTradeCondition: string;
  riskFlags: string[];
  observableFacts: string[];
  contradictions: string[];
  indicators: string[];
  checklist: string[];
  relevantEventTypes: string[];
  levels: Level[];
  plotBounds?: { left: number; top: number; right: number; bottom: number };
  priceScaleAnchors?: { price: number; y: number }[];
};

type PlotBounds = DevicePlotBounds;
type LocalScan = DeviceLocalScan;
type ChartSlot = WorkspaceSource<Analysis> & { name: string; localScan: LocalScan | null; reportIntention?: Intention };

function emptyChartSlots(): ChartSlot[] { return Array.from({ length: 5 }, () => ({ image: null, name: "", analysis: null, localScan: null, confirmation: null, status: "IDLE", revision: 0, runState: "IDLE", message: "" })); }
const TABS: Array<{ id: Tab; label: string; short: string }> = [
  { id: "overview", label: "Overview", short: "OV" },
  { id: "levels", label: "Levels", short: "LV" },
  { id: "structure", label: "Structure", short: "ST" },
  { id: "patterns", label: "Patterns", short: "PT" },
  { id: "liquidity", label: "Liquidity", short: "LQ" },
  { id: "risk", label: "Risk", short: "RK" },
];

function clamp(value: number) { return Math.max(2, Math.min(98, Number.isFinite(value) ? value : 50)); }


function withinPlot(y: number, bounds: PlotBounds, pad = 1.5) {
  return Number.isFinite(y) && y >= bounds.top - pad && y <= bounds.bottom + pad;
}

function mergeOverlayLevels(ai: Level[], local: Level[], bounds: PlotBounds) {
  const safeAi = ai.filter(level => ["support","resistance","pivot"].includes(level.kind) && withinPlot(level.y, bounds));
  const merged = local.map(level => {
    const match = safeAi.find(candidate =>
      Math.abs(candidate.y - level.y) <= 4 &&
      (candidate.kind === level.kind || candidate.kind === "pivot")
    );
    return match ? { ...level, label: match.label || level.label, price: match.price || level.price } : level;
  });
  for (const level of safeAi) {
    if (!merged.some(existing => Math.abs(existing.y - level.y) <= 3)) merged.push(level);
  }
  return merged.sort((a,b)=>a.y-b.y).slice(0,4);
}

function mergeOverlayPatterns(ai: Pattern[], local: Pattern[], bounds: PlotBounds) {
  const safeAi = ai.filter(pattern => {
    const points = pattern.geometry?.points ?? [];
    return points.length >= 2 && points.every(point =>
      point.x >= bounds.left - 2 && point.x <= bounds.right + 2 && withinPlot(point.y, bounds, 2)
    );
  });
  const merged = safeAi.filter(pattern => pattern.confidence !== "LOW" || pattern.status === "CONFIRMED" || pattern.status === "FAILED");
  for (const pattern of local.filter(pattern => pattern.confidence !== "LOW" || pattern.status === "CONFIRMED" || pattern.status === "FAILED")) {
    if (!merged.some(existing => existing.name === pattern.name)) merged.push(pattern);
  }
  return merged.slice(0,3);
}

function mergeOverlayLiquidity(ai: LiquidityRead | undefined, local: LiquidityRead | undefined, bounds: PlotBounds): LiquidityRead | undefined {
  const safeAiZones = (ai?.zones ?? []).filter(zone =>
    withinPlot(zone.y, bounds) &&
    Number.isFinite(zone.x) && Number.isFinite(zone.x2) &&
    zone.x2 - zone.x >= 3
  );
  const localZones = (local?.zones ?? []).filter(zone =>
    withinPlot(zone.y, bounds) &&
    Number.isFinite(zone.x) && Number.isFinite(zone.x2) &&
    zone.x2 - zone.x >= 3
  );
  const zones = [...safeAiZones];
  for (const zone of localZones) {
    if (!zones.some(existing => existing.side === zone.side && Math.abs(existing.y - zone.y) <= 3)) zones.push(zone);
  }
  if (!zones.length) return ai ?? local;
  const narrative = safeAiZones.length ? ai : local;
  return {
    state: narrative?.state === "VERIFIED" ? "VERIFIED" : "PARTIAL",
    event: narrative?.event ?? "TESTING",
    confidence: narrative?.confidence ?? "LOW",
    evidence: narrative?.evidence || "Device geometry marked visible swing references.",
    confirmation: narrative?.confirmation || "A visible sweep, reclaim or rejection is still required.",
    invalidation: narrative?.invalidation || "Clean acceptance beyond the reference invalidates it.",
    zones: zones.slice(0,4),
  };
}


function demoChart() {
  const candles = Array.from({ length: 42 }, (_, i) => {
    const x = 72 + i * 27;
    const center = 360 - i * 4 + Math.sin(i * .9) * 48;
    const open = center + Math.sin(i * 1.7) * 18;
    const close = center + Math.cos(i * 1.3) * 17;
    const high = Math.min(open, close) - 25 - (i % 4) * 4;
    const low = Math.max(open, close) + 27 + (i % 3) * 5;
    const up = close < open;
    return '<line x1="'+x+'" x2="'+x+'" y1="'+high+'" y2="'+low+'" stroke="'+(up?"#6cae8a":"#b96f69")+'" stroke-width="2"/><rect x="'+(x-6)+'" y="'+Math.min(open,close)+'" width="12" height="'+Math.max(8,Math.abs(close-open))+'" fill="'+(up?"#6cae8a":"#b96f69")+'"/>';
  }).join("");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#111722"/><g stroke="#263140" stroke-width="1">'+
    [120,220,320,420,520,620].map(y=>'<line x1="48" x2="1230" y1="'+y+'" y2="'+y+'"/>').join("")+
    '</g>'+candles+'<text x="50" y="54" fill="#d8e0e8" font-family="Arial" font-size="22">US 500 · 15m · Interface demo</text><text x="50" y="682" fill="#718094" font-family="Arial" font-size="15">Synthetic chart — no market data</text></svg>';
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const DEMO_ANALYSIS: Analysis = {
  direction: "NEUTRAL", confidence: "MEDIUM", instrument: "US 500", ticker: "SPX", timeframe: "15m", currentPrice: "7721",
  evidenceQuality: { chartReadability: "CLEAR", instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true, candlesReadable: true, limitations: [] },
  higherTimeframe: { provided: true, timeframe: "1h", direction: "BULLISH", alignment: "MIXED", summary: "The 1h structure is constructive, but the 15m is pressing into nearby resistance." },
  patterns: [{ name: "RECTANGLE / RANGE", status: "FORMING", confidence: "MEDIUM", evidence: "Price is rotating between repeated upper and lower references.", confirmation: "Acceptance above the upper boundary.", invalidation: "Clean break below the lower boundary.", geometry: { points: [{x:18,y:34},{x:82,y:34},{x:82,y:68},{x:18,y:68}], labelX: 72, labelY: 27 } }],
  liquidity: { state: "PARTIAL", event: "TESTING", confidence: "MEDIUM", evidence: "Repeated highs form a visible buy-side reference, but no completed sweep is confirmed.", confirmation: "Trade beyond the highs followed by a return beneath them.", invalidation: "Clean acceptance above the highs.", zones: [{ side: "BUY_SIDE", basis: "EQUAL_HIGHS", price: "7740", x: 38, x2: 83, y: 31 }] },
  nextSequence: { now: "WAIT", confirmation: "Acceptance above 7740 with structure holding.", failure: "Loss of 7700 support.", patience: "Do not chase inside the range.", reassess: "After the next decisive break or rejection." },
  summary: "Price is holding constructively, but the immediate location is poor beneath resistance.",
  verdict: "WAIT", verdictHeadline: "Strength is visible. Confirmation is not.", setupScore: { overall: 61, grade: "C", structure: 7, momentum: 6, location: 4, confirmation: 4, riskClarity: 7, eventSafety: 8 },
  whatYouMayBeMissing: ["The higher-timeframe tone is constructive, but the current entry location is still underneath a repeated resistance reference."],
  improvesSetup: ["Acceptance above resistance", "Higher low holds after breakout"], killsSetup: ["Loss of 7700", "Failed breakout back into range"], traderTrap: "Chasing the top of a range because momentum feels strong.",
  bullishCase: "Break and acceptance above 7740 opens room for continuation.", bearishCase: "Failure at 7740 followed by loss of 7700 turns the range into rejection.", invalidation: "Sustained trade below 7700.",
  marketStructure: "Short-term higher lows are intact, but price remains inside a defined range.", levelStory: "7700 is the primary support reference; 7740 is the immediate resistance ceiling.", momentum: "Positive but not decisive.",
  bullConfirmation: "Acceptance above 7740.", bearConfirmation: "Loss of 7700.", noTradeCondition: "Remain inside the 7700–7740 range without confirmation.", riskFlags: ["Entry location is close to resistance", "Range breakout is not confirmed"],
  observableFacts: ["Higher lows are visible", "Repeated highs remain overhead"], contradictions: ["Momentum is positive while location remains poor"], indicators: [], checklist: [], relevantEventTypes: ["FOMC", "CPI"],
  levels: [
    { kind: "resistance", label: "Range high", price: "7740", x: 12, y: 31, x2: 92, y2: 31 },
    { kind: "pivot", label: "Midpoint", price: "7720", x: 18, y: 49, x2: 87, y2: 49 },
    { kind: "support", label: "Range support", price: "7700", x: 10, y: 68, x2: 94, y2: 68 },
  ],
};

function statusOf(analysis: Analysis, kind: "levels" | "patterns" | "liquidity" | "htf") {
  if (kind === "levels") return analysis.levels.some((l) => ["support","resistance","pivot"].includes(l.kind) && /^-?\d/.test(l.price)) ? "REPORTED" : analysis.levels.length ? "PARTIAL" : "NONE";
  if (kind === "patterns") return analysis.patterns.some((p) => p.confidence !== "LOW" && p.status !== "AMBIGUOUS") ? "REPORTED" : analysis.patterns.length ? "PARTIAL" : "NONE";
  if (kind === "liquidity") return analysis.liquidity?.state === "VERIFIED" ? "REPORTED" : analysis.liquidity?.state ?? "NONE";
  return analysis.higherTimeframe.provided ? "REPORTED" : "NONE";
}

function statusLabel(value: string) { return value === "NONE" ? "NO EVIDENCE" : value; }

const UNAVAILABLE_MACRO: VerifiedMacroContext = {generatedAt:"",status:"unavailable",observations:[],releases:[],filings:[],availableSources:[],unavailableSources:[]};
export default function PocketNext({macroContext=UNAVAILABLE_MACRO,igDemoAvailable=false,igDemoDisconnectAvailable=false,igDemoOwnerScope,igDemoChartBinding}:{macroContext?:VerifiedMacroContext;igDemoAvailable?:boolean;igDemoDisconnectAvailable?:boolean;igDemoOwnerScope?:string;igDemoChartBinding?:IgDemoChartBinding} = {}) {
  const [charts, setCharts] = useState<ChartSlot[]>(emptyChartSlots);
  const [activeChart, setActiveChart] = useState(0);
  const activeChartRef = useRef(activeChart);
  activeChartRef.current = activeChart;
  const [intention, setIntention] = useState<Intention>("UNSURE");
  const [privacy, setPrivacy] = useState(false);
  const [active, setActive] = useState<Tab>("overview");
  const [busyChart, setBusyChart] = useState<number | null>(null);
  const [chartFocus, setChartFocus] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadingSlots, setUploadingSlots] = useState<boolean[]>(() => Array(5).fill(false));
  const requestActive = useRef(false);
  const chartEpoch = useRef(createChartRequestEpoch());
  const uploads = useRef([0, 0, 0, 0, 0]);
  const controllerRef = useRef<AbortController | null>(null);
  const requestSource = useRef<{ index: number; revision: number; confirmation: ChartConfirmation } | null>(null);
  const chartsRef = useRef(charts);
  chartsRef.current = charts;
  const demoSnapshot = useRef<{ charts: ChartSlot[]; activeChart: number; privacy: boolean } | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const invalidate = (reason = "Analysis cancelled. You can retry after checking the chart.") => {
    const source = requestSource.current;
    chartEpoch.current.invalidate(); controllerRef.current?.abort(); controllerRef.current = null;
    requestSource.current = null; requestActive.current = false; setBusyChart(null);
    if (source) setCharts(current => current.map((slot, index) => index === source.index && slot.revision === source.revision
      ? { ...slot, runState: "CANCELLED", message: slot.analysis ? reason + " The previous report is still shown." : reason } : slot));
  };
  useEffect(() => () => { chartEpoch.current.invalidate(); controllerRef.current?.abort(); uploads.current = uploads.current.map(n => n + 1); }, []);
  useEffect(() => {
    const stop = () => { if(document.visibilityState === 'hidden') {chartEpoch.current.invalidate();controllerRef.current?.abort();controllerRef.current=null;requestSource.current=null;requestActive.current=false;setBusyChart(null);setCharts(current=>current.map(slot=>slot.runState==='RUNNING'?{...slot,runState:'CANCELLED',message:'Analysis cancelled in the background.'}:slot));setNotice('Analysis cancelled while the app was in the background. Run a new check.');} };
    const hide = () => {chartEpoch.current.invalidate();controllerRef.current?.abort();controllerRef.current=null;requestSource.current=null;requestActive.current=false;setBusyChart(null);setCharts(current=>current.map(slot=>slot.runState==='RUNNING'?{...slot,runState:'CANCELLED',message:'Analysis cancelled in the background.'}:slot));};
    document.addEventListener('visibilitychange',stop);window.addEventListener('pagehide',hide);
    return()=>{document.removeEventListener('visibilitychange',stop);window.removeEventListener('pagehide',hide);};
  }, []);
  const centreRef = useRef<HTMLElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartImageRef = useRef<HTMLImageElement | null>(null);
  const [imageBox, setImageBox] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const activeSlot = charts[activeChart];
  const igDemoContextKey = `${activeChart}:${activeSlot.revision}:${activeSlot.status}:${JSON.stringify(activeSlot.confirmation)}`;
  const igDemoToken = igDemoChartToken(igDemoChartBinding,igDemoOwnerScope,igDemoContextKey);
  const analysis = activeSlot?.analysis ?? null;
  const image = activeSlot?.image ?? null;
  const busy = busyChart !== null;
  const uploading = uploadingSlots.some(Boolean);
  const sourceStatus = uploadingSlots[activeChart] ? "READING IMAGE" : workspaceSlotLabel(activeSlot);
  const analysisHold = !image ? "Add a source chart to begin." : !privacy ? "Confirm that personal details are removed from every uploaded chart."
    : !preflightAllowsAnalysis(activeSlot.status) || !activeSlot.confirmation ? "Chart checks are pending. Follow the short guidance below or explore the demo."
    : busy ? `Chart ${Number(busyChart) + 1} is being analysed. You can cancel it below.` : "Ready for evidence-based analysis.";

  useEffect(() => {
    const chart = chartRef.current;
    const img = chartImageRef.current;
    if (!chart || !img) return;
    const sync = () => {
      const chartRect = chart.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      if (!img.naturalWidth || !img.naturalHeight || !imgRect.width || !imgRect.height) return;
      const naturalRatio = img.naturalWidth / img.naturalHeight;
      const boxRatio = imgRect.width / imgRect.height;
      let width = imgRect.width, height = imgRect.height, offsetX = 0, offsetY = 0;
      if (boxRatio > naturalRatio) {
        width = imgRect.height * naturalRatio;
        offsetX = (imgRect.width - width) / 2;
      } else if (boxRatio < naturalRatio) {
        height = imgRect.width / naturalRatio;
        offsetY = (imgRect.height - height) / 2;
      }
      setImageBox({
        left: imgRect.left - chartRect.left + offsetX,
        top: imgRect.top - chartRect.top + offsetY,
        width,
        height,
      });
    };
    sync();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    observer?.observe(chart);
    observer?.observe(img);
    window.addEventListener("resize", sync);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [image, chartFocus]);

  useEffect(() => {
    if (!chartFocus) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    chartRef.current?.querySelector<HTMLButtonElement>(".pnFocusButton")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChartFocus(false);
      if (event.key !== "Tab") return;
      const controls = chartRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [chartFocus]);

  const selectTab = (tab: Tab) => {
    setActive(tab);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches) {
      window.requestAnimationFrame(() => centreRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const loadChart = async (index: number, file?: File) => {
    if (!file || demoMode) return;
    invalidate("The source chart is being replaced; the current request was cancelled.");
    const revision = ++uploads.current[index];
    setUploadingSlots(current => current.map((value, i) => i === index ? true : value));
    try {
      const nextImage = await readWorkspaceImage(file);
      if (uploads.current[index] !== revision) return;
      setCharts(current => current.map((slot, i) => i === index ? { image: nextImage, name: file.name, analysis: null, localScan: null, confirmation: null, status: "CHECKING", revision, runState: "IDLE", message: "" } : slot));
      setPrivacy(false);
      setNotice("");
      setActiveChart(index);
    } catch (e) {
      if (uploads.current[index] === revision) {
        setCharts(current => current.map((slot, i) => i === index
          ? { ...slot, message: (e instanceof Error ? e.message : "Could not load that chart.") + (slot.image ? " Your previous chart and report were kept." : "") } : slot));
        setActiveChart(index);
      }
    } finally {
      if (uploads.current[index] === revision) setUploadingSlots(current => current.map((value, i) => i === index ? false : value));
    }
  };

  const changePreflight = (index: number, revision: number, status: PreflightStatus) => {
    if (chartsRef.current[index]?.revision !== revision) return;
    if (!preflightAllowsAnalysis(status) && requestSource.current?.index === index) invalidate("Chart facts were unlocked; the previous request was cancelled.");
    setCharts(current => current.map((slot, i) => i === index ? { ...updateWorkspacePreflight(slot, revision, status), localScan: preflightAllowsAnalysis(status) ? slot.localScan : null } : slot));
  };
  const changeConfirmation = (index: number, revision: number, confirmation: ChartConfirmation | null) => {
    if (chartsRef.current[index]?.revision !== revision) return;
    const pending = requestSource.current;
    if (pending?.index === index && !sameWorkspaceFacts(pending.confirmation, confirmation)) invalidate("Chart facts changed; the previous request was cancelled.");
    setCharts(current => current.map((slot, i) => i === index ? updateWorkspaceConfirmation(slot, revision, confirmation) : slot));
  };

  const analyseChart = async (index: number, switchAfter = false) => {
    const slot = charts[index];
    if (!slot?.image || !privacy || busy || uploading || requestActive.current || !preflightAllowsAnalysis(slot.status) || !slot.confirmation || demoMode) return;
    const token = chartEpoch.current.snapshot();
    const controller = new AbortController(); controllerRef.current = controller;
    const confirmation = slot.confirmation;
    requestSource.current = { index, revision: slot.revision, confirmation };
    requestActive.current = true; setBusyChart(index); setNotice("");
    setCharts(current => current.map((chart, i) => i === index ? { ...chart, runState: "RUNNING", message: "" } : chart));
    try {
      const precisionImage = await precisionCrop(slot.image);
      if (!chartEpoch.current.isCurrent(token) || controller.signal.aborted) return;
      const response = await pocketAuthenticatedFetch("/api/pocket/analyse", {
        method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ image: slot.image, precisionImage, intention, chartConfirmation: slot.confirmation }),
      });
      const payload = await response.json() as { analysis?: Analysis; error?: string };
      if (!chartEpoch.current.isCurrent(token) || controller.signal.aborted) return;
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Analysis could not complete.");
      const report = prepareScannerReport(payload.analysis);
      setCharts(current => current.map((chart, i) => {
        if (i !== index) return chart;
        const accepted = acceptWorkspaceReport(chart, slot.revision, confirmation, report);
        return accepted === chart ? chart : { ...accepted, reportIntention: intention };
      }));
      if (switchAfter) setActiveChart(index);
      if (activeChartRef.current === index || switchAfter) setActive("overview");
    } catch (e) {
      if (chartEpoch.current.isCurrent(token) && !controller.signal.aborted) setCharts(current => current.map((chart, i) => i === index && chart.revision === slot.revision
        ? { ...chart, runState: "ERROR", message: (e instanceof Error ? e.message : "Analysis could not complete.") + (chart.analysis ? " The previous report is still shown." : " No report was produced; retry only after checking the cause.") } : chart));
    } finally {
      if (controllerRef.current === controller) { controllerRef.current = null; requestSource.current = null; requestActive.current = false; setBusyChart(null); }
    }
  };

  const run = async () => { await analyseChart(activeChart, false); };

  const selectChart = async (index: number) => {
    if (index === activeChart || (demoMode && !charts[index].image)) return;
    setActiveChart(index);
    setActive("overview");
  };

  const openDemo = () => {
    if (busy || uploading) return;
    demoSnapshot.current = { charts, activeChart, privacy };
    invalidate(); setDemoMode(true); uploads.current = uploads.current.map(n => n + 1);
    const demo = emptyChartSlots();
    demo[0] = { ...demo[0], image: demoChart(), name: "Interface demo", analysis: DEMO_ANALYSIS };
    setCharts(demo);
    setActiveChart(0);
    setActive("overview");
    setPrivacy(false);
    setNotice("");
  };
  const reset = () => {
    invalidate(); setDemoMode(false); uploads.current = uploads.current.map(n => n + 1);
    setCharts(demoSnapshot.current?.charts ?? emptyChartSlots());
    setActiveChart(demoSnapshot.current?.activeChart ?? 0);
    setPrivacy(demoSnapshot.current?.privacy ?? false);
    demoSnapshot.current = null;
    setUploadingSlots(Array(5).fill(false));
    setActive("overview");
    setChartFocus(false);
    setNotice("");
  };
  const share = async () => {
    if (!analysis) return;
    const text = UNVERIFIED_SCANNER_NOTICE + "\n" + POCKET_PRODUCT.displayName + (demoMode ? " · SYNTHETIC INTERFACE DEMO" : "") + " · " + analysis.instrument + " · " + analysis.timeframe + "\n" + analysis.verdict + " · " + analysis.setupScore.overall + "/100\n" + analysis.verdictHeadline;
    try {
      if (navigator.share) await navigator.share({ title: POCKET_PRODUCT.displayName, text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); setNotice("Decision summary copied."); }
      else setNotice("Sharing is unavailable in this browser.");
    } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setNotice("The summary could not be shared. Your report is still available."); }
  };

  const overlayMode = active;
  const activeLocal = activeSlot?.localScan;
  const plotBounds: PlotBounds = activeLocal?.plotBounds
    ?? analysis?.plotBounds
    ?? { left: 4, top: 12, right: 91, bottom: 88 };
  const levels = mergeOverlayLevels(
    analysis?.levels.filter((l) => ["support","resistance","pivot"].includes(l.kind)) ?? [],
    activeLocal?.levels ?? [],
    plotBounds,
  );
  const patterns = mergeOverlayPatterns(analysis?.patterns ?? [], activeLocal?.patterns ?? [], plotBounds);
  const devicePatternCount = activeLocal?.patterns.filter(pattern => pattern.confidence !== "LOW" || pattern.status === "CONFIRMED" || pattern.status === "FAILED").length ?? 0;
  const liquidity = mergeOverlayLiquidity(analysis?.liquidity, activeLocal?.liquidity, plotBounds);
  const claimConfirmed = !demoMode && Boolean(activeSlot?.confirmation && preflightAllowsAnalysis(activeSlot.status));
  const claimMeasurement = useOriginalChartMeasurement(image, analysis, claimConfirmed);
  const deviceOnly = Boolean(activeLocal && !activeSlot?.analysis);
  const multiChart = useMemo(() => {
    const loaded = charts.filter(slot=>slot.image).length;
    const ready = charts.filter(slot=>slot.analysis).length;
    const structural = charts.filter(slot=>(slot.localScan?.levels.length ?? 0)>=2).length;
    const cleanPatterns = charts.filter(slot=>(slot.localScan?.patterns ?? []).some(pattern=>pattern.confidence!=="LOW"&&pattern.status!=="AMBIGUOUS")).length;
    const liquidityRefs = charts.filter(slot=>(slot.localScan?.liquidity.zones.length ?? 0)>0).length;
    const verifiedScales = charts.filter(slot=>(slot.analysis?.priceScaleAnchors?.length ?? 0)>=2).length;
    return { loaded, ready, structural, cleanPatterns, liquidityRefs, verifiedScales };
  }, [charts]);
  const overlayStyle = imageBox.width > 0 && imageBox.height > 0 ? {
    left: imageBox.left,
    top: imageBox.top,
    width: imageBox.width,
    height: imageBox.height,
    right: "auto",
    bottom: "auto",
  } : undefined;

  if (!analysis) return <main className="pnApp pnStartApp" aria-busy={busy || uploading}>
    <a className="pnSkip" href="#pn-intake">Skip to chart workspace</a>
    <header className="pnTop">
      <div className="pnBrand"><span className="pnMark">{POCKET_PRODUCT.shortName}</span><div><strong>{POCKET_PRODUCT.name.toUpperCase()}</strong><small>{POCKET_PRODUCT.tagline}</small></div></div>
      <div className="pnEngine"><button type="button" onClick={openDemo}>Explore demo</button><a href="/pocket/login">Account</a></div>
    </header>

    <section className="pnStart">
      <article className="pnIntro">
        <p>PRE-TRADE DECISION WORKSPACE</p>
        <h1>Intelligence<br/><em>before execution.</em></h1>
        <span>Upload the chart you are actually looking at. {POCKET_PRODUCT.shortName} separates visible evidence from assumptions, then shows what confirms the idea, what weakens it and when doing nothing is the better decision.</span>
        <div className="pnPrinciples">
          <div><b>01</b><strong>VERIFY</strong><small>Evidence before precision</small></div>
          <div><b>02</b><strong>CHALLENGE</strong><small>Bias gets tested</small></div>
          <div><b>03</b><strong>DECIDE</strong><small>Wait is a valid answer</small></div>
        </div>
        <section className="pnSession" aria-label="Current workspace"><span>THIS SESSION</span><strong>{multiChart.loaded} / 5 charts</strong><p>{multiChart.ready} reports returned · each source keeps its own confirmation and report.</p><p>{workspaceContext(charts)}</p></section>
      </article>

      <aside className="pnIntake" id="pn-intake" aria-label="Five-chart workspace">
        <div className="pnIntakeHead"><span>CHART {activeChart + 1} · {CHART_SLOT_HINTS[activeChart]} SLOT</span><small>{sourceStatus}</small></div>
        <label className="pnDrop" data-loaded={image ? "true" : "false"}>
          {image ? <img src={image} alt={`Selected chart ${activeChart + 1}`}/> : <div><b>+</b><strong>Add a source chart</strong><span>JPEG · PNG · WEBP · max 8 MB</span></div>}
          <input aria-label={`${image ? "Replace" : "Add"} chart ${activeChart + 1}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>{void loadChart(activeChart,e.target.files?.[0]);e.target.value="";}}/>
          {image ? <footer><strong>{activeSlot.name}</strong><span>Tap to replace</span></footer> : null}
        </label>

        <div className="pnIntakeSlots" aria-label="Select chart slot">
          {charts.map((slot, index)=><button key={index} type="button" aria-pressed={activeChart===index} data-loaded={Boolean(slot.image)} onClick={()=>void selectChart(index)} aria-label={`Chart ${index+1}, suggested ${CHART_SLOT_HINTS[index]}, ${uploadingSlots[index] ? "reading image" : workspaceSlotLabel(slot)}`}>
            <b>{CHART_SLOT_HINTS[index]}</b><small>{uploadingSlots[index] ? "READING" : slot.confirmation?.timeframe || workspaceSlotLabel(slot)}</small>
          </button>)}
        </div>
        <p className="pnSlotHint">Suggested slots only. Each chart’s printed labels are checked automatically.</p>

        <div className="pnBias">
          <small>BIAS TO CHALLENGE</small>
          <div>{(["LONG","UNSURE","SHORT"] as Intention[]).map(v=><button key={v} type="button" data-active={intention===v} aria-pressed={intention===v} onClick={()=>{invalidate("Your trading bias changed; run a new analysis after checking your inputs.");setIntention(v);}}>{v==="UNSURE"?"NO BIAS":v}</button>)}</div>
        </div>

        <NativeSubscriptionControls />
        <IgDemoWorkspace ownerScope={igDemoOwnerScope} available={igDemoAvailable} disconnectAvailable={igDemoDisconnectAvailable} contextKey={igDemoContextKey} chartToken={igDemoToken} />
        <label className="pnPrivacy"><input type="checkbox" checked={privacy} onChange={(e)=>{if(!e.target.checked)invalidate("Privacy confirmation was removed; analysis was cancelled.");setPrivacy(e.target.checked);}}/><span><strong>Privacy check</strong>I removed account numbers, balances and personal notifications from every chart.</span></label>

        {image ? <ChartPreflightPanel key={`${activeChart}:${activeSlot.revision}`} image={image} onStatus={status => changePreflight(activeChart,activeSlot.revision,status)} onConfirmation={confirmation => changeConfirmation(activeChart,activeSlot.revision,confirmation)} /> : null}
        <p className="pnHold" id="pn-analysis-hold" role="status">{analysisHold}</p>
        {busy ? <button className="pnCancel" type="button" onClick={()=>invalidate()}>CANCEL CHART {Number(busyChart)+1} ANALYSIS</button> : null}
        {activeSlot.message ? <p role={activeSlot.runState==="CANCELLED" ? "status" : "alert"} className="pnError">{activeSlot.message}</p> : null}
        <button className="pnRun" type="button" aria-describedby="pn-analysis-hold" disabled={!image || !privacy || busy || uploading || !preflightAllowsAnalysis(activeSlot.status) || !activeSlot.confirmation} onClick={run}><span>{busyChart===activeChart ? "ANALYSING…" : "ANALYSE CHART "+(activeChart+1)}</span><b aria-hidden="true">→</b></button>
        <button className="pnDemo" type="button" disabled={busy||uploading} onClick={openDemo}>EXPLORE THE NO-CREDIT INTERFACE DEMO</button>
      </aside>
    </section>
  </main>;

  const stateTone = analysis.direction === "BULLISH" ? "bull" : analysis.direction === "BEARISH" ? "bear" : "wait";

  return <main className="pnApp pnResultApp" data-tone={stateTone} aria-busy={busy || uploading}>
    <a className="pnSkip" href="#pn-chart-workspace">Skip to chart evidence</a>
    <header className="pnTop pnResultTop">
      <div className="pnBrand"><span className="pnMark">{POCKET_PRODUCT.shortName}</span><div><strong>{POCKET_PRODUCT.name.toUpperCase()}</strong><small>{POCKET_PRODUCT.tagline} · {analysis.instrument} · {analysis.timeframe}</small></div></div>
      <div className="pnTopActions"><button type="button" onClick={share}>SHARE</button><button type="button" onClick={reset}>{demoMode ? "RETURN TO YOUR CHARTS" : "CLEAR WORKSPACE"}</button></div>
    </header>

    <ScannerClaimStatus report={analysis} image={image} measurement={claimMeasurement} confirmed={claimConfirmed} />
    <section className="pnWorkspace">
      <nav className="pnTools" aria-label="Analysis views">
        {TABS.map(tab=><button key={tab.id} type="button" data-active={active===tab.id} aria-pressed={active===tab.id} onClick={()=>selectTab(tab.id)}><b aria-hidden="true">{tab.short}</b><span>{tab.label}</span></button>)}
      </nav>

      <section className="pnCentre" ref={centreRef} id="pn-chart-workspace" aria-label="Chart evidence workspace">
        {demoMode ? <p className="pnDemoBanner" role="status">INTERFACE DEMO · synthetic sample · no uploaded chart analysed · no credits used</p> : <section className="pnSourceControls" aria-label="Source and analysis controls">
          {activeSlot.confirmation && preflightAllowsAnalysis(activeSlot.status) ? <section className="pnLockedFacts" aria-label="Locked source chart facts"><div><span>SOURCE CHART FACTS</span><strong>{activeSlot.confirmation.instrument} · {activeSlot.confirmation.timeframe} · {activeSlot.confirmation.currentPrice}</strong></div><button type="button" onClick={()=>changePreflight(activeChart,activeSlot.revision,"IDLE")}>Recheck chart facts</button></section> : <ChartPreflightPanel key={`${activeChart}:${activeSlot.revision}`} image={image??""} onStatus={status => changePreflight(activeChart,activeSlot.revision,status)} onConfirmation={confirmation => changeConfirmation(activeChart,activeSlot.revision,confirmation)} />}
          {!privacy ? <label className="pnPrivacy"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/><span><strong>Confirm upload privacy</strong>Personal details are removed from every uploaded chart.</span></label> : null}
          <div className="pnSourceActions"><button type="button" disabled={busy || uploading || !privacy || !activeSlot.confirmation || !preflightAllowsAnalysis(activeSlot.status)} onClick={() => void analyseChart(activeChart)}>{busyChart===activeChart ? "ANALYSING CHART "+(activeChart+1) : "RECHECK THIS CHART"}</button>
          {busy ? <button className="pnCancel" type="button" onClick={()=>invalidate()}>CANCEL CHART {Number(busyChart)+1}</button> : null}
          <label className="pnReplace">Replace source<input type="file" aria-label={`Replace chart ${activeChart+1}`} accept="image/jpeg,image/png,image/webp" onChange={e=>{void loadChart(activeChart,e.target.files?.[0]);e.target.value="";}}/></label></div>
          {activeSlot.message ? <p role={activeSlot.runState==="CANCELLED"?"status":"alert"} className="pnError">{activeSlot.message}</p> : null}
        </section>}
        {notice ? <p className="pnNotice" role="status">{notice}</p> : null}
        <header className="pnChartHeader">
          <div><small>ACTIVE VIEW</small><strong>{TABS.find(t=>t.id===active)?.label}</strong></div>
          <div className="pnQuality">
            <span data-state={analysis.evidenceQuality.chartReadability==="CLEAR"?"REPORTED":"PARTIAL"}>CHART {analysis.evidenceQuality.chartReadability}</span>
            <span data-state={statusOf(analysis,"levels")}>LEVELS {statusLabel(statusOf(analysis,"levels"))}</span>
            <span data-state={statusOf(analysis,"patterns")}>PATTERN {statusLabel(statusOf(analysis,"patterns"))}</span>
            <span data-state={statusOf(analysis,"liquidity")}>LIQUIDITY {statusLabel(statusOf(analysis,"liquidity"))}</span>
          </div>
        </header>

        <div className="pnMobileDecision" data-device={deviceOnly ? "true" : "false"} aria-label="Decision snapshot">
          {deviceOnly ? <>
            <span>DEVICE SCAN</span>
            <strong>READY<small>STRUCTURE</small></strong>
            <b>ZERO CREDIT · {activeLocal?.candleCount ?? 0} CANDLES</b>
          </> : <>
            <span>{analysis.verdict.replaceAll("_"," ")}</span>
            <strong>{analysis.setupScore.overall}<small>/100 · {analysis.setupScore.grade}</small></strong>
            <b>{analysis.instrument} · {analysis.timeframe}</b>
          </>}
        </div>

        <div className="pnChartSwitcher" aria-label="Chart selector">
          {charts.map((slot,index)=>slot.image ? <button
            key={index}
            type="button"
            data-active={activeChart===index}
            data-busy={busyChart===index}
            aria-pressed={activeChart===index}
            aria-label={`Chart ${index+1}, ${workspaceSlotTimeframe(slot, CHART_SLOT_HINTS[index], demoMode)}, ${demoMode ? "DEMO" : workspaceSlotLabel(slot)}`}
            onClick={()=>void selectChart(index)}
          ><span>{workspaceSlotTimeframe(slot, CHART_SLOT_HINTS[index], demoMode)}</span><strong>{uploadingSlots[index] ? "READING" : demoMode ? "DEMO" : workspaceSlotLabel(slot)}</strong></button> : <label key={index} className="pnChartAdd" data-disabled={demoMode}>
            <input aria-label={`Add chart ${index+1}, suggested ${CHART_SLOT_HINTS[index]}`} disabled={demoMode} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>{void loadChart(index,e.target.files?.[0]);e.target.value="";}}/>
            <span>{CHART_SLOT_HINTS[index]}</span><strong>{demoMode ? "—" : "+"}</strong>
          </label>)}
        </div>

        <div className="pnChart" ref={chartRef} data-focus={chartFocus ? "true" : "false"} role={chartFocus?"dialog":undefined} aria-modal={chartFocus?true:undefined} aria-label={chartFocus?"Focused source chart":undefined}>
          {demoMode ? <img ref={chartImageRef} src={image ?? ""} alt="Synthetic interface demo chart"/> : <OriginalChartEvidence measurement={claimMeasurement} layer={active === "patterns" ? "patterns" : active === "liquidity" ? "liquidity" : "levels"} image={image ?? ""} report={analysis} identityConfirmed={Boolean(activeSlot.confirmation) && preflightAllowsAnalysis(activeSlot.status)} /> }
          <button className="pnFocusButton" type="button" onClick={()=>setChartFocus(v=>!v)} aria-pressed={chartFocus}>{chartFocus ? "CLOSE" : "FOCUS"}</button>
          {demoMode && <svg style={overlayStyle} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${POCKET_PRODUCT.shortName} evidence overlay`}>
            <defs>
              <clipPath id="pnPlotClip">
                <rect x={plotBounds.left} y={plotBounds.top} width={Math.max(1,plotBounds.right-plotBounds.left)} height={Math.max(1,plotBounds.bottom-plotBounds.top)}/>
              </clipPath>
            </defs>
            <g clipPath="url(#pnPlotClip)">
              {(overlayMode==="overview"||overlayMode==="levels") ? levels.map((level,i)=><g key={"l"+i} data-kind={level.kind}>
                <rect className="pnLevelBand" x={clamp(level.x || plotBounds.left)} y={clamp(level.y)-.45} width={Math.max(1,clamp(level.x2 || plotBounds.right)-clamp(level.x || plotBounds.left))} height=".9"/>
                <line x1={clamp(level.x || plotBounds.left)} x2={clamp(level.x2 || plotBounds.right)} y1={clamp(level.y)} y2={clamp(level.y2 || level.y)}/>
                <circle cx={clamp(level.x || plotBounds.left)} cy={clamp(level.y)} r=".8"/>
              </g>) : null}
              {overlayMode==="patterns" ? patterns.flatMap((p,pi)=>p.geometry?.points?.length ? [<g key={"p"+pi} data-pattern={p.status}>
                <polyline points={p.geometry.points.map(pt=>clamp(pt.x)+","+clamp(pt.y)).join(" ")}/>
                {p.geometry.points.map((pt,i)=><circle key={i} className="pnPatternPoint" cx={clamp(pt.x)} cy={clamp(pt.y)} r=".72"/>)}
              </g>] : []) : null}
              {overlayMode==="liquidity" ? (liquidity?.zones ?? []).map((z,i)=><g key={"q"+i} data-side={z.side}>
                <rect className="pnLiquidityBand" x={clamp(z.x)} y={clamp(z.y)-.75} width={Math.max(1,clamp(z.x2)-clamp(z.x))} height="1.5"/>
                <line x1={clamp(z.x)} x2={clamp(z.x2)} y1={clamp(z.y)} y2={clamp(z.y)}/>
              </g>) : null}
            </g>
          </svg>}
          {demoMode && overlayMode==="levels" ? <div style={overlayStyle} className="pnLevelLabels">{levels.slice(0,6).filter(l=>withinPlot(l.y,plotBounds)).map((l,i)=><span key={i} data-kind={l.kind} style={{top:clamp(l.y)+"%"}}><small>{l.kind.toUpperCase()}</small><b>{l.price || l.label}</b></span>)}</div> : null}
          {demoMode && overlayMode==="patterns" ? <div style={overlayStyle} className="pnPatternLabels">{patterns.filter(p=>p.geometry?.points?.length).slice(0,3).map((p,i)=><span key={i} style={{left:clamp(p.geometry!.labelX)+"%",top:clamp(p.geometry!.labelY)+"%"}}>{p.name}</span>)}</div> : null}
          {demoMode && overlayMode==="liquidity" ? <div style={overlayStyle} className="pnLevelLabels">{(liquidity?.zones ?? []).filter(z=>withinPlot(z.y,plotBounds)).map((z,i)=><span key={i} data-kind={z.side==="BUY_SIDE"?"resistance":"support"} style={{top:clamp(z.y)+"%"}}><small>{z.side.replace("_"," ")}</small><b>{z.price || z.basis.replaceAll("_"," ")}</b></span>)}</div> : null}
        </div>

        <footer className="pnChartFoot">
          <span>{activeLocal ? `DEVICE · ${activeLocal.levels.length} LV · ${devicePatternCount} PT · ${activeLocal.liquidity.zones.length} LQ` : "SOURCE IMAGE PRESERVED"}</span>
          <span>{active==="levels" ? analysis.levelStory : active==="structure" ? analysis.marketStructure : active==="patterns" ? (patterns[0]?.evidence || "No defensible pattern is currently verified.") : active==="liquidity" ? (liquidity?.evidence || "No defensible liquidity event is currently verified.") : "Select a scanner to isolate its evidence on the chart."}</span>
        </footer>
        {!demoMode && !deviceOnly && image && activeSlot.confirmation && preflightAllowsAnalysis(activeSlot.status) ? <PocketWorkflowDesk key={`workflow-${activeChart}-${activeSlot.revision}-${activeSlot.reportRevision??0}`} image={image} report={analysis} intention={activeSlot.reportIntention??intention} macroContext={macroContext}/> : null}
      </section>

      <aside className="pnDecision">
        {active==="overview" ? <>
          <div className="pnDecisionLabel">{deviceOnly ? "DEVICE STRUCTURE SCAN" : "DECISION SUMMARY"}</div>
          {deviceOnly ? <>
            <div className="pnDeviceReady"><span>STRUCTURE READY</span><small>ZERO-CREDIT DEVICE CHECK</small></div>
            <h2>{levels.length} levels · {patterns.length} pattern read{patterns.length===1?"":"s"} · {liquidity?.zones.length ?? 0} liquidity reference{(liquidity?.zones.length ?? 0)===1?"":"s"}</h2>
            <p>No setup score or risk grade is shown because this chart has not used the AI judgement layer.</p>
          </> : <>
            <p>UNVERIFIED MODEL SCORE · NOT ACCURACY</p><div className="pnVerdict"><span>{analysis.verdict.replaceAll("_"," ")}</span><b>{analysis.setupScore.overall}</b><small>/100 · GRADE {analysis.setupScore.grade}</small></div>
            <h2>{analysis.verdictHeadline}</h2>
            <p>{analysis.summary}</p>
            <div className="pnTriptych"><article><small>NOW</small><strong>{analysis.nextSequence.now}</strong></article><article><small>CONFIRMS</small><strong>{analysis.nextSequence.confirmation}</strong></article><article><small>FAILS</small><strong>{analysis.nextSequence.failure}</strong></article></div>
            <section className="pnMiss"><small>STRONGEST COUNTER-EVIDENCE</small><strong>{analysis.whatYouMayBeMissing[0] || analysis.contradictions[0] || "No strong contradiction was returned."}</strong></section>
          </>}
          <div className="pnRows pnMultiChart"><article><span>MULTI-CHART CONTEXT</span><strong>{multiChart.ready}/{multiChart.loaded || 1} reports returned</strong><small>{demoMode ? "Synthetic example only; your charts have not been compared." : workspaceContext(charts)}</small></article><article><span>PRICE CONFLUENCE</span><strong>{multiChart.verifiedScales>=2 ? "Multiple model scales reported; original-pixel verification required" : "No verified price confluence established"}</strong><small>{POCKET_PRODUCT.shortName} will only claim cross-timeframe price confluence when numeric scales are independently verified.</small></article></div>
        </> : null}

        {active==="levels" ? <>
          {!demoMode && !deviceOnly ? <details className="pnToolDetails" open><summary>Options Wall Cross-check</summary><OptionsWallCheck key={`options-${activeChart}-${activeSlot.revision}`} ticker={analysis.ticker} levels={analysis.levels} /></details> : null}
          <div className="pnDecisionLabel">REPORTED PRICE REFERENCES</div>
          <h2>{levels.length ? levels.length+" structural levels" : "Precision held"}</h2>
          <p>{analysis.levelStory}</p>
          <div className="pnRows">{levels.length ? levels.map((l,i)=><article key={i}><span>{l.kind.toUpperCase()} · UNVERIFIED</span><strong>{l.price || "NO NUMERIC PRICE"}</strong><small>Reported candidate; see price-position checks above.</small></article>) : <article><span>NO VERIFIED LEVEL</span><strong>—</strong><small>{POCKET_PRODUCT.shortName} withheld numeric precision.</small></article>}</div>
        </> : null}

        {active==="structure" ? <>
          <div className="pnDecisionLabel">MARKET STRUCTURE</div>
          <h2>{analysis.direction} · UNVERIFIED MODEL VIEW</h2>
          <p>{analysis.marketStructure}</p>
          <div className="pnRows"><article><span>MOMENTUM</span><strong>{analysis.momentum}</strong></article><article><span>HIGHER TIMEFRAME</span><strong>{analysis.higherTimeframe.alignment}</strong><small>{analysis.higherTimeframe.summary}</small></article><article><span>BULL CASE</span><strong>{analysis.bullishCase}</strong></article><article><span>BEAR CASE</span><strong>{analysis.bearishCase}</strong></article></div>
        </> : null}

        {active==="patterns" ? <>
          <div className="pnDecisionLabel">PATTERN REVIEW</div>
          <h2>{patterns.length ? patterns.length+" reported candidate"+(patterns.length===1?"":"s") : "PATTERN HOLD · no verified candidate"}</h2>
          <p>Reported candidates stay separate from original-pixel checks. The chart overlay shows only candidates that pass those independent checks.</p>
          <div className="pnRows">{patterns.length ? patterns.map((p,i)=><article key={i}><span>UNVERIFIED · REPORTED {p.status}</span><strong>{p.name}</strong><small>{p.evidence}</small></article>) : <article><span>NO EVIDENCE</span><strong>Nothing forced.</strong><small>A wider or clearer chart may add evidence.</small></article>}</div>
        </> : null}

        {active==="liquidity" ? <>
          {!demoMode && !deviceOnly ? <CryptoDerivativesCheck key={`crypto-${activeChart}-${activeSlot.revision}`} ticker={analysis.ticker !== "UNKNOWN" ? analysis.ticker : analysis.instrument} structure={analysis.marketStructure} /> : null}
          <div className="pnDecisionLabel">LIQUIDITY GUARD</div>
          <h2>{liquidity?.state==="NONE" || !liquidity ? "LIQUIDITY HOLD" : "UNVERIFIED LIQUIDITY CLAIMS"}</h2>
          <p>{liquidity?.evidence || `${POCKET_PRODUCT.shortName} does not infer hidden orders or stop placement from ordinary price noise.`}</p>
          <div className="pnRows"><article><span>STATE</span><strong>UNVERIFIED</strong><small>Model claim; no hidden-order proof</small></article><article><span>CONFIRMS</span><strong>{liquidity?.confirmation || "No defensible trigger."}</strong></article><article><span>INVALIDATES</span><strong>{liquidity?.invalidation || "No defensible invalidation."}</strong></article></div>
        </> : null}

        {active==="risk" ? <>
          <details className="pnToolDetails" open><summary>Personal risk calculator</summary><PersonalRiskDesk /></details>
          <div className="pnDecisionLabel">RISK & DISCIPLINE</div>
          {deviceOnly ? <>
            <h2>AI risk judgement not run</h2>
            <p>The zero-credit device pass measures chart geometry only. It does not assign a setup score, trade risk grade or directional permission.</p>
            <div className="pnRows"><article><span>DEVICE CHECK</span><strong>Structure only</strong><small>Use Levels, Patterns and Liquidity for screenshot-derived evidence.</small></article></div>
          </> : <>
            <h2>{analysis.riskFlags.length ? analysis.riskFlags.length+" active risk flag"+(analysis.riskFlags.length===1?"":"s") : "No major flag returned"}</h2>
            <p>{analysis.noTradeCondition}</p>
            <div className="pnRows">{analysis.riskFlags.map((r,i)=><article key={i}><span>RISK {String(i+1).padStart(2,"0")}</span><strong>{r}</strong></article>)}<article><span>INVALIDATION</span><strong>{analysis.invalidation}</strong></article><article><span>TRADER TRAP</span><strong>{analysis.traderTrap}</strong></article></div>
          </>}
        </> : null}
        {!demoMode ? <IgDemoWorkspace ownerScope={igDemoOwnerScope} available={igDemoAvailable} disconnectAvailable={igDemoDisconnectAvailable} contextKey={igDemoContextKey} chartToken={igDemoToken} /> : null}
        {!demoMode ? <details className="pnToolDetails pnAccount"><summary>Account & subscription</summary><NativeSubscriptionControls /></details> : null}
      </aside>
    </section>
  </main>;
}
