import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { MemberShell } from "../components/MemberShell";
import { analyzeMarketSnapshot } from "../lib/market-intelligence-engine";
import { createTradingDecision } from "../lib/trading-decision-engine";
import { createStructuredTradePlan } from "../lib/structured-trade-planner";
import { formatSnapshotAge, formatUkTimestamp, hasDisplayableQuotes, createUnavailableSnapshot } from "../lib/market-data";
import { createMarketDeskSignals, deskCandleContextFromRange } from "../lib/market-desk-signals";
import { createMarketStructureLevels } from "../lib/market-structure-levels";
import { getConfiguredFmpCandlesForInstruments, toCustomerCandleSeries } from "../lib/providers/financial-modeling-prep-candles";
import { getMarketInstrument, type MarketInstrument } from "../lib/markets/market-catalog";
import { isCandleInstrument } from "../lib/providers/candle-instruments";
import { rangeLaneFromCandles } from "../components/mini-visuals/mini-visual-data";
import { persistAnalysisSnapshot } from "../lib/server/market-snapshots";
import { createUnconfiguredMarketGatewayStatus } from "../lib/live-market-gateway";
import { TradingDeskOS } from "./components/TradingDeskOS";
import { DeskErrorBoundary } from "./components/DeskErrorBoundary";
import { TerminalControls } from "./components/TerminalControls";
import { getTerminalMarketData } from "./lib/terminal-market-data-provider";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "./lib/membership-entitlement";
import { loadPreviewClaims } from "./lib/preview-access";
import { formatCustomerParticipationWarnings } from "./lib/customer-warnings";
import { terminalMarketState } from "./lib/visual-terminal";
import { readSessionClock } from "./lib/session-clock";
import { createEdgeBrief } from "./lib/edge-brief";
import { createCatalystRadar } from "./lib/catalyst-radar";
import { buildDeskDecisionPresentation } from "./lib/desk-decision-presentation";
import { dedupeVerifiedEvents } from "./lib/event-display";
import {
  DESK_WORKSPACE_COOKIE,
  createDefaultWorkspace,
  normalizeWorkspace,
  parseWorkspaceCookie,
} from "./lib/desk-workspace";
import { mapCandleFreshness, type DeskFreshnessFeed, type TradingDeskPayload } from "./lib/desk-payload";
import { sanitizeForClient } from "../lib/serialize-for-client.ts";
import { resolveSessionMarketVideos } from "../lib/market-video/session-placement.ts";
import { membershipEmailKey } from "../lib/server/membership-email.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trading Desk",
  description: "Customizable trading desk across interchangeable markets — verified feeds only.",
  robots: { index: false, follow: false },
};

export default async function Terminal() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.email) redirect("/?membership=required#membership");

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("plan, status, current_period_end")
    .eq("email", membershipEmailKey(user.email))
    .in("plan", ["free", "pro", "elite"])
    .maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError));
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));
  const previewState = await loadPreviewClaims(user.id);
  const access = createProgressiveAccess(tier, previewState.claims);
  const previewOffer = access.previewOffer;
  const paid = access.tier === "pro" || access.tier === "elite";

  const cookieStore = await cookies();
  const initialWorkspace = normalizeWorkspace(
    parseWorkspaceCookie(cookieStore.get(DESK_WORKSPACE_COOKIE)?.value) ?? createDefaultWorkspace(),
  );

  let payload: TradingDeskPayload;
  try {
    const [{ snapshot, gatewayStatus }, candleBundleRaw] = await Promise.all([
      getTerminalMarketData(),
      paid
        ? getConfiguredFmpCandlesForInstruments("5m").catch(() => null)
        : Promise.resolve(null),
    ]);

    const candleSeriesByInstrument = candleBundleRaw
      ? {
          ES: toCustomerCandleSeries(candleBundleRaw.ES),
          VIX: toCustomerCandleSeries(candleBundleRaw.VIX),
          DXY: toCustomerCandleSeries(candleBundleRaw.DXY),
          OIL: toCustomerCandleSeries(candleBundleRaw.OIL),
          QQQ: toCustomerCandleSeries(candleBundleRaw.QQQ),
          IXIC: toCustomerCandleSeries(candleBundleRaw.IXIC),
        }
      : null;

    const candleSeries = candleSeriesByInstrument?.ES ?? null;
    const rangeLane = candleSeries?.candles.length ? rangeLaneFromCandles(candleSeries.candles) : null;
    const intelligence = analyzeMarketSnapshot(snapshot);
    const decision = createTradingDecision({
      intelligence,
      reasoning: intelligence.reasoning,
      dataStatus: snapshot.status,
      providerStatus: gatewayStatus.connectionStatus,
      dataAgeMs: gatewayStatus.dataAgeMs,
      fallbackActive: gatewayStatus.fallbackActive,
      missingDataWarnings: intelligence.reasoning.missingDataWarnings,
    });
    const plan = createStructuredTradePlan({
      decision,
      intelligence,
      dataStatus: snapshot.status,
      providerStatus: gatewayStatus.connectionStatus,
      dataAgeMs: gatewayStatus.dataAgeMs,
      fallbackActive: gatewayStatus.fallbackActive,
      missingDataWarnings: intelligence.reasoning.missingDataWarnings,
    });
    const deskCandle = deskCandleContextFromRange(rangeLane);
    const deskSignals = access.features.intelligence
      ? createMarketDeskSignals({
          snapshot,
          intelligence,
          decision,
          plan,
          candle: deskCandle,
        })
      : null;
    const structureLevels = createMarketStructureLevels({
      snapshot,
      candlesBySymbol: {
        ES: candleSeriesByInstrument?.ES?.candles,
        VIX: candleSeriesByInstrument?.VIX?.candles,
        DXY: candleSeriesByInstrument?.DXY?.candles,
        OIL: candleSeriesByInstrument?.OIL?.candles,
        QQQ: candleSeriesByInstrument?.QQQ?.candles,
          IXIC: candleSeriesByInstrument?.IXIC?.candles,
      },
    });

    const state = terminalMarketState(snapshot.status, gatewayStatus.connectionStatus, gatewayStatus.fallbackActive);
    const timestamp = snapshot.quotes.length > 0 ? formatUkTimestamp(snapshot.asOf) : "Unavailable";
    const snapshotAge = formatSnapshotAge(snapshot.asOf);
    const session = readSessionClock(new Date());
    const customerWarnings = formatCustomerParticipationWarnings(
      decision.noTradeReasons,
      decision.dataQualityWarnings,
      plan.eventRiskWarnings.map((warning) => warning.code),
    );
    const decisionPresentation = buildDeskDecisionPresentation({
      decision,
      plan,
      signals: deskSignals,
      warnings: customerWarnings,
    });
    const displayEvents = dedupeVerifiedEvents(snapshot.events);
    snapshot.events = displayEvents;

    const freshnessFeeds: DeskFreshnessFeed[] = [
      {
        id: "snapshot",
        label: "Market snapshot",
        status:
          snapshot.status === "LIVE"
            ? "LIVE"
            : snapshot.status === "DELAYED"
              ? "DELAYED"
              : hasDisplayableQuotes(snapshot)
                ? "STALE"
                : "UNAVAILABLE",
        ageLabel: snapshotAge,
        detail: snapshot.source || "Verified provider snapshot",
      },
      mapCandleFreshness(candleSeriesByInstrument?.ES, "ES candles"),
      mapCandleFreshness(candleSeriesByInstrument?.IXIC, "IXIC candles"),
      mapCandleFreshness(candleSeriesByInstrument?.QQQ, "QQQ candles"),
      mapCandleFreshness(candleSeriesByInstrument?.VIX, "VIX candles"),
      mapCandleFreshness(candleSeriesByInstrument?.DXY, "DXY candles"),
      mapCandleFreshness(candleSeriesByInstrument?.OIL, "OIL candles"),
      {
        id: "calendar",
        label: "Economic calendar",
        status: snapshot.events.length ? "DELAYED" : "UNAVAILABLE",
        ageLabel: snapshot.events.length ? `${snapshot.events.length} rows` : "Empty",
        detail: snapshot.events.length
          ? "US medium/high-impact rows from the verified economic calendar."
          : "No verified calendar rows in the current snapshot.",
      },
      {
        id: "news",
        label: "News intelligence",
        status: "UNAVAILABLE",
        ageLabel: "Unavailable",
        detail: "No verified news data connection is currently available.",
      },
      {
        id: "earnings",
        label: "Earnings calendar",
        status: "UNAVAILABLE",
        ageLabel: "Unavailable",
        detail: "No verified earnings data connection is currently available.",
      },
    ];

    const favourites = initialWorkspace.favourites
      .map((id) => getMarketInstrument(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const active = getMarketInstrument(initialWorkspace.activeMarketId) ?? getMarketInstrument("es")!;
    const catalystRadar = createCatalystRadar({
      events: snapshot.events,
      active,
      favourites,
    });

    const briefTargets = new Map<string, MarketInstrument>();
    for (const id of [active.id, ...initialWorkspace.favourites]) {
      const instrument = getMarketInstrument(id);
      if (instrument) briefTargets.set(instrument.id, instrument);
    }
    const edgeBriefByMarketId: TradingDeskPayload["edgeBriefByMarketId"] = {};
    for (const instrument of briefTargets.values()) {
      const candle =
        candleSeriesByInstrument && isCandleInstrument(instrument.symbol)
          ? candleSeriesByInstrument[instrument.symbol]
          : null;
      edgeBriefByMarketId[instrument.id] = createEdgeBrief({
        instrument,
        snapshot,
        candle,
        structure: structureLevels.instruments.find((row) => row.symbol === instrument.symbol) ?? null,
        deskSignals,
        events: snapshot.events,
        session,
        snapshotAge,
      });
    }

    void persistAnalysisSnapshot({
      snapshot,
      intelligence,
      decision,
      plan,
      gateway: gatewayStatus,
      kind: "refresh",
      candleRefs: rangeLane
        ? {
            rangeHigh: rangeLane.high,
            rangeLow: rangeLane.low,
            firstClose: rangeLane.firstClose,
            ema20: rangeLane.ema20,
            ema50: rangeLane.ema50,
            latest: rangeLane.current,
          }
        : null,
    });

    const sessionVideos = resolveSessionMarketVideos({ phase: session.phase });

    payload = sanitizeForClient({
      paid,
      tier: access.tier,
      snapshot,
      gatewayStatus,
      marketState: state,
      timestamp,
      snapshotAge,
      candleSeriesByInstrument,
      structureLevels,
      deskSignals,
      session,
      edgeBriefByMarketId,
      catalystRadar,
      freshnessFeeds,
      customerWarnings,
      decisionPresentation,
      initialWorkspace,
      deskVideoShortcut: sessionVideos.deskShortcut,
      preview: {
        eligible: previewOffer?.targetTier === "pro" && previewOffer.eligible,
        available: previewState.available,
        cadence: previewOffer?.cadence,
      },
    });
  } catch (error) {
    console.error("[terminal] desk payload failed; rendering recovery shell", error);
    const session = readSessionClock(new Date());
    const active = getMarketInstrument(initialWorkspace.activeMarketId) ?? getMarketInstrument("es")!;
    const snapshot = createUnavailableSnapshot();
    const gatewayStatus = createUnconfiguredMarketGatewayStatus("Terminal desk recovery");
    const recoveryWarnings = ["Verified market data is currently unavailable"];
    payload = sanitizeForClient({
      paid,
      tier: access.tier,
      snapshot,
      gatewayStatus,
      marketState: "unavailable",
      timestamp: "Unavailable",
      snapshotAge: "Unavailable",
      candleSeriesByInstrument: null,
      structureLevels: null,
      deskSignals: null,
      session,
      edgeBriefByMarketId: {
        [active.id]: createEdgeBrief({
          instrument: active,
          snapshot,
          candle: null,
          structure: null,
          deskSignals: null,
          events: [],
          session,
          snapshotAge: "Unavailable",
        }),
      },
      catalystRadar: createCatalystRadar({ events: [], active, favourites: [] }),
      freshnessFeeds: [
        {
          id: "snapshot",
          label: "Market snapshot",
          status: "UNAVAILABLE",
          ageLabel: "Unavailable",
          detail: "Desk recovered after a temporary error. Refresh to retry verified feeds.",
        },
      ],
      customerWarnings: recoveryWarnings,
      decisionPresentation: buildDeskDecisionPresentation({
        decision: null,
        plan: null,
        signals: null,
        warnings: recoveryWarnings,
      }),
      initialWorkspace,
      deskVideoShortcut: null,
      preview: {
        eligible: previewOffer?.targetTier === "pro" && previewOffer.eligible,
        available: previewState.available,
        cadence: previewOffer?.cadence,
      },
    });
  }

  return (
    <MemberShell
      active="terminal"
      className="customerTerminal premiumTerminal terminalMemberPage tradingDeskPage"
      toolbar={<div className="ctToolbar ctTopbar"><TerminalControls /></div>}
    >
      <div className="memberDashboardShell ctWorkspace deskWorkspaceShell" style={{ color: "#eef2f5" }}>
        <DeskErrorBoundary>
          <TradingDeskOS payload={payload} />
        </DeskErrorBoundary>
      </div>
    </MemberShell>
  );
}
