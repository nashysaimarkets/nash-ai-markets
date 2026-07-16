import { createPreviewSnapshot, type MarketDataProvider, type MarketSnapshot, normalizeSnapshotFreshness } from "./market-data.ts";

export type MarketSliceAdapter = {
  name: string;
  fetchSnapshot: () => Promise<MarketSnapshot | null>;
};

export type ProviderHealthStatus = "healthy" | "degraded" | "offline";

export type ProviderConnectionState = {
  status: ProviderHealthStatus;
  lastSuccessfulUpdate: string | null;
  lastAttempt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  dataFreshness: "fresh" | "stale" | "unknown";
};

export type LiveMarketGatewayOptions = {
  provider: MarketDataProvider;
  fallbackSnapshot?: MarketSnapshot;
  maxRetries?: number;
  retryDelayMs?: number;
  logger?: (message: string, details?: Record<string, unknown>) => void;
};

function createFallbackSnapshot(): MarketSnapshot {
  return {
    ...createPreviewSnapshot(),
    status: "PREVIEW",
    source: "Simulated market gateway fallback",
    summary: "The live provider is unavailable. Simulated market data is being shown while the gateway retries.",
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

      return snapshots.reduce<MarketSnapshot>((accumulator, { snapshot }) => ({
        ...accumulator,
        status: accumulator.status === "LIVE" && snapshot.status === "LIVE" ? "LIVE" : "DELAYED",
        source: `${accumulator.source}, ${snapshot.source}`,
        asOf: snapshot.asOf,
        quotes: [...accumulator.quotes, ...snapshot.quotes],
        levels: [...accumulator.levels, ...snapshot.levels],
        events: [...accumulator.events, ...snapshot.events],
        bias: snapshot.bias || accumulator.bias,
        risk: snapshot.risk || accumulator.risk,
        summary: snapshot.summary || accumulator.summary,
        evidence: { ...accumulator.evidence, ...snapshot.evidence },
      }), snapshots[0]?.snapshot ?? createFallbackSnapshot());
    },
  };
}

export class LiveMarketGateway {
  private provider: MarketDataProvider;
  private fallbackSnapshot: MarketSnapshot;
  private maxRetries: number;
  private retryDelayMs: number;
  private logger: (message: string, details?: Record<string, unknown>) => void;
  private state: ProviderConnectionState = {
    status: "offline",
    lastSuccessfulUpdate: null,
    lastAttempt: null,
    consecutiveFailures: 0,
    lastError: null,
    dataFreshness: "unknown",
  };

  constructor(options: LiveMarketGatewayOptions) {
    this.provider = options.provider;
    this.fallbackSnapshot = options.fallbackSnapshot ?? createFallbackSnapshot();
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 300;
    this.logger = options.logger ?? ((message, details) => console.info(`[${message}]`, details ?? {}));
  }

  getState(): ProviderConnectionState {
    return { ...this.state };
  }

  async fetchSnapshot(now = Date.now()): Promise<MarketSnapshot> {
    const timestamp = new Date().toISOString();
    this.state.lastAttempt = timestamp;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const snapshot = await this.provider.fetchSnapshot();
        if (snapshot) {
          const normalized = normalizeSnapshotFreshness(snapshot, now);
          this.state.status = normalized.status === "LIVE" || normalized.status === "DELAYED" ? "healthy" : "degraded";
          this.state.lastSuccessfulUpdate = timestamp;
          this.state.consecutiveFailures = 0;
          this.state.lastError = null;
          this.state.dataFreshness = normalized.status === "LIVE" ? "fresh" : normalized.status === "DELAYED" ? "stale" : "unknown";
          this.logger("market-provider:success", { status: normalized.status, source: normalized.source, attempt: attempt + 1 });
          return normalized;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown provider error";
        this.state.consecutiveFailures += 1;
        this.state.lastError = message;
        this.state.status = this.state.consecutiveFailures >= 2 ? "offline" : "degraded";
        this.logger("market-provider:error", { error: message, attempt: attempt + 1, consecutiveFailures: this.state.consecutiveFailures });
      }

      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * (attempt + 1)));
      }
    }

    const fallback = normalizeSnapshotFreshness(this.fallbackSnapshot, now);
    this.state.status = "offline";
    this.state.dataFreshness = "stale";
    this.logger("market-provider:fallback", { source: fallback.source, status: fallback.status });
    return fallback;
  }
}
