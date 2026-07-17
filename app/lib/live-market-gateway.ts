import {
  createUnavailableSnapshot,
  type MarketDataProvider,
  type MarketEvent,
  type MarketQuote,
  type MarketSnapshot,
  normalizeSnapshotFreshness,
} from "./market-data.ts";

export const REQUIRED_MARKET_GATEWAY_COVERAGE = [
  "sp500Futures",
  "vix",
  "us2YearYield",
  "us10YearYield",
  "usDollarIndex",
  "economicCalendar",
] as const;

export type MarketGatewayCoverage = typeof REQUIRED_MARKET_GATEWAY_COVERAGE[number];

export type LiveMarketProviderPayload = {
  sp500Futures: MarketQuote;
  vix: MarketQuote;
  us2YearYield: MarketQuote;
  us10YearYield: MarketQuote;
  usDollarIndex: MarketQuote;
  economicCalendar: MarketEvent[];
  snapshot: Omit<MarketSnapshot, "quotes" | "events">;
};

/** Contract for a future licensed provider. No paid provider is connected in this build. */
export interface LiveMarketProviderContract {
  readonly name: string;
  readonly coverage: Readonly<Record<MarketGatewayCoverage, true>>;
  fetchMarketData(): Promise<LiveMarketProviderPayload | null>;
}

export type MarketSliceAdapter = {
  name: string;
  fetchSnapshot: () => Promise<MarketSnapshot | null>;
};

export type MarketGatewayConnectionStatus = "connected" | "degraded" | "offline" | "not_configured";

export type MarketGatewayStatus = {
  connectionStatus: MarketGatewayConnectionStatus;
  providerName: string;
  lastAttempt: string | null;
  lastSuccessfulUpdate: string | null;
  dataAgeMs: number | null;
  failureCount: number;
  fallbackActive: boolean;
  lastRefreshLatencyMs: number | null;
  reconnectAttempts: number;
};

export type LiveMarketGatewayOptions = {
  provider: MarketDataProvider;
  providerName: string;
  maxRetries?: number;
  retryDelayMs?: number;
  logger?: (message: string, details?: Record<string, unknown>) => void;
};

export function createProviderContractAdapter(contract: LiveMarketProviderContract): MarketDataProvider {
  return {
    async fetchSnapshot() {
      const payload = await contract.fetchMarketData();
      if (!payload) return null;
      return {
        ...payload.snapshot,
        source: payload.snapshot.source || contract.name,
        quotes: [
          payload.sp500Futures,
          payload.vix,
          payload.us2YearYield,
          payload.us10YearYield,
          payload.usDollarIndex,
        ],
        events: payload.economicCalendar,
      };
    },
  };
}

export function createCompositeMarketDataProvider(slices: MarketSliceAdapter[]): MarketDataProvider {
  return {
    async fetchSnapshot() {
      const snapshots = (await Promise.all(slices.map(async (slice) => ({
        slice,
        snapshot: await slice.fetchSnapshot(),
      })))).filter((entry): entry is { slice: MarketSliceAdapter; snapshot: MarketSnapshot } => Boolean(entry.snapshot));

      if (snapshots.length === 0) return null;

      return snapshots.slice(1).reduce<MarketSnapshot>((accumulator, { snapshot }) => ({
        ...accumulator,
        status: accumulator.status === "LIVE" && snapshot.status === "LIVE" ? "LIVE" : "DELAYED",
        source: `${accumulator.source}, ${snapshot.source}`,
        asOf: new Date(accumulator.asOf).getTime() <= new Date(snapshot.asOf).getTime() ? accumulator.asOf : snapshot.asOf,
        quotes: [...accumulator.quotes, ...snapshot.quotes],
        levels: [...accumulator.levels, ...snapshot.levels],
        events: [...accumulator.events, ...snapshot.events],
        bias: snapshot.bias || accumulator.bias,
        risk: snapshot.risk || accumulator.risk,
        summary: snapshot.summary || accumulator.summary,
        evidence: { ...accumulator.evidence, ...snapshot.evidence },
      }), snapshots[0]!.snapshot);
    },
  };
}

function dataAgeMs(asOf: string, now: number): number | null {
  const timestamp = new Date(asOf).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : null;
}

export function createUnconfiguredMarketGatewayStatus(providerName = "Not configured"): MarketGatewayStatus {
  return {
    connectionStatus: "not_configured",
    providerName,
    lastAttempt: null,
    lastSuccessfulUpdate: null,
    dataAgeMs: null,
    failureCount: 0,
    fallbackActive: true,
    lastRefreshLatencyMs: null,
    reconnectAttempts: 0,
  };
}

export function formatMarketGatewayDataAge(dataAgeMs: number | null): string {
  if (dataAgeMs === null) return "Unavailable";
  const seconds = Math.floor(dataAgeMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export class LiveMarketGateway {
  private provider: MarketDataProvider;
  private maxRetries: number;
  private retryDelayMs: number;
  private logger: (message: string, details?: Record<string, unknown>) => void;
  private state: MarketGatewayStatus;

  constructor(options: LiveMarketGatewayOptions) {
    this.provider = options.provider;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 300;
    this.logger = options.logger ?? ((message, details) => console.info(`[${message}]`, details ?? {}));
    this.state = {
      connectionStatus: "offline",
      providerName: options.providerName,
      lastAttempt: null,
      lastSuccessfulUpdate: null,
      dataAgeMs: null,
      failureCount: 0,
      fallbackActive: false,
      lastRefreshLatencyMs: null,
      reconnectAttempts: 0,
    };
  }

  getStatus(): MarketGatewayStatus {
    return { ...this.state };
  }

  /** Compatibility alias for existing callers. */
  getState(): MarketGatewayStatus {
    return this.getStatus();
  }

  async fetchSnapshot(now = Date.now()): Promise<MarketSnapshot> {
    const refreshStartedAt = Date.now();
    this.state.lastAttempt = new Date(now).toISOString();
    this.state.reconnectAttempts = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      this.state.reconnectAttempts = attempt;
      try {
        const snapshot = await this.provider.fetchSnapshot();
        if (!snapshot) throw new Error("Provider returned no market snapshot");

        const normalized = normalizeSnapshotFreshness(snapshot, now);
        if (normalized.status !== "LIVE" && normalized.status !== "DELAYED") {
          throw new Error(`Provider snapshot is ${normalized.status.toLowerCase()}`);
        }

        this.state.connectionStatus = normalized.status === "LIVE" ? "connected" : "degraded";
        this.state.lastSuccessfulUpdate = normalized.asOf;
        this.state.dataAgeMs = dataAgeMs(normalized.asOf, now);
        this.state.fallbackActive = false;
        this.state.lastRefreshLatencyMs = Math.max(0, Date.now() - refreshStartedAt);
        this.logger("market-provider:success", { status: normalized.status, provider: this.state.providerName, attempt: attempt + 1 });
        return normalized;
      } catch {
        this.state.failureCount += 1;
        this.state.connectionStatus = "offline";
        this.logger("market-provider:error", {
          category: "provider_request_failed",
          provider: this.state.providerName,
          attempt: attempt + 1,
          failureCount: this.state.failureCount,
        });
      }

      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * (attempt + 1)));
      }
    }

    this.state.fallbackActive = true;
    this.state.dataAgeMs = this.state.lastSuccessfulUpdate ? dataAgeMs(this.state.lastSuccessfulUpdate, now) : null;
    this.state.lastRefreshLatencyMs = Math.max(0, Date.now() - refreshStartedAt);
    this.logger("market-provider:fallback", { provider: this.state.providerName });
    return createUnavailableSnapshot(this.state.lastSuccessfulUpdate ?? undefined);
  }
}
