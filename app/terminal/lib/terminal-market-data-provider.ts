import {
  createUnconfiguredMarketGatewayStatus,
  LiveMarketGateway,
  type MarketGatewayStatus,
} from "../../lib/live-market-gateway.ts";
import {
  createHttpMarketDataProvider,
  createUnavailableSnapshot,
  type MarketDataProvider,
  type MarketDataProviderInput,
  type MarketSnapshot,
} from "../../lib/market-data.ts";
import {
  createFinancialModelingPrepAdapter,
  DEFAULT_FINANCIAL_MODELING_PREP_BASE_URL,
  FINANCIAL_MODELING_PREP_PROVIDER_NAME,
} from "../../lib/providers/financial-modeling-prep.ts";
import { createAsyncTtlCache } from "../../lib/server/async-ttl-cache.ts";

export type TerminalMarketGatewayResult = {
  snapshot: MarketSnapshot;
  gatewayStatus: MarketGatewayStatus;
  cache: MarketDataCacheDiagnostics;
};

export type MarketDataCacheDiagnostics = {
  status: "hit" | "miss" | "coalesced" | "bypass" | "disabled";
  ttlMs: number;
  hits: number;
  misses: number;
  coalesced: number;
  providerLoads: number;
  estimatedProviderLoadsAvoided: number;
};

type CachedMarketGatewayResult = Omit<TerminalMarketGatewayResult, "cache">;

const MARKET_DATA_CACHE_TTL_MS = 15_000;
const configuredMarketDataCache = createAsyncTtlCache<CachedMarketGatewayResult>({
  ttlMs: MARKET_DATA_CACHE_TTL_MS,
  isFailure: ({ snapshot }) => snapshot.status !== "LIVE" && snapshot.status !== "DELAYED",
});

function cacheDiagnostics(status: MarketDataCacheDiagnostics["status"]): MarketDataCacheDiagnostics {
  const stats = configuredMarketDataCache.getStats();
  return {
    status,
    ttlMs: MARKET_DATA_CACHE_TTL_MS,
    hits: stats.hits,
    misses: stats.misses,
    coalesced: stats.coalesced,
    providerLoads: stats.loads,
    estimatedProviderLoadsAvoided: stats.hits + stats.coalesced,
  };
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export type FmpEnvironmentDiagnostics = {
  marketDataProviderConfigured: boolean;
  fmpApiKeyConfigured: boolean;
  fmpApiBaseUrlConfigured: boolean;
  fmpSp500FuturesSymbolConfigured: boolean;
  fmpVixSymbolConfigured: boolean;
  fmpUsDollarIndexSymbolConfigured: boolean;
  fmpRequestTimeoutConfigured: boolean;
  marketDataMaxRetriesConfigured: boolean;
  marketDataRetryDelayConfigured: boolean;
  supabaseUrlConfigured: boolean;
  supabasePublishableKeyConfigured: boolean;
  supabaseServiceRoleKeyConfigured: boolean;
  openAIApiKeyConfigured: boolean;
  openAIBriefModelConfigured: boolean;
  openAIMorningBriefModelConfigured: boolean;
};

export function getFmpEnvironmentDiagnostics(): FmpEnvironmentDiagnostics {
  return {
    marketDataProviderConfigured: Boolean(process.env.MARKET_DATA_PROVIDER?.trim()),
    fmpApiKeyConfigured: Boolean(process.env.FMP_API_KEY?.trim()),
    fmpApiBaseUrlConfigured: Boolean(process.env.FMP_API_BASE_URL?.trim()),
    fmpSp500FuturesSymbolConfigured: Boolean(process.env.FMP_SP500_FUTURES_SYMBOL?.trim()),
    fmpVixSymbolConfigured: Boolean(process.env.FMP_VIX_SYMBOL?.trim()),
    fmpUsDollarIndexSymbolConfigured: Boolean(process.env.FMP_US_DOLLAR_INDEX_SYMBOL?.trim()),
    fmpRequestTimeoutConfigured: Boolean(process.env.FMP_REQUEST_TIMEOUT_MS?.trim()),
    marketDataMaxRetriesConfigured: Boolean(process.env.MARKET_DATA_MAX_RETRIES?.trim()),
    marketDataRetryDelayConfigured: Boolean(process.env.MARKET_DATA_RETRY_DELAY_MS?.trim()),
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    supabasePublishableKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()),
    supabaseServiceRoleKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    openAIApiKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    openAIBriefModelConfigured: Boolean(process.env.OPENAI_BRIEF_MODEL?.trim()),
    openAIMorningBriefModelConfigured: Boolean(process.env.OPENAI_MORNING_BRIEF_MODEL?.trim()),
  };
}

function createConfiguredProvider(): { provider: MarketDataProvider; name: string } | null {
  const providerType = process.env.MARKET_DATA_PROVIDER?.trim().toLowerCase();
  if (providerType === "fmp") {
    const apiKey = process.env.FMP_API_KEY?.trim();
    if (!apiKey) return null;
    return {
      name: FINANCIAL_MODELING_PREP_PROVIDER_NAME,
      provider: createFinancialModelingPrepAdapter({
        apiKey,
        baseUrl: process.env.FMP_API_BASE_URL?.trim() || DEFAULT_FINANCIAL_MODELING_PREP_BASE_URL,
        timeoutMs: positiveInteger(process.env.FMP_REQUEST_TIMEOUT_MS),
        symbols: {
          sp500Futures: process.env.FMP_SP500_FUTURES_SYMBOL,
          vix: process.env.FMP_VIX_SYMBOL,
          usDollarIndex: process.env.FMP_US_DOLLAR_INDEX_SYMBOL,
        },
        logger: (message, details) => console.info(`[${message}]`, details ?? {}),
      }),
    };
  }

  const configuredUrl = process.env.MARKET_DATA_API_URL;
  if (!configuredUrl) return null;
  return {
    name: process.env.MARKET_DATA_PROVIDER_NAME?.trim() || "Configured HTTP market provider",
    provider: createHttpMarketDataProvider({ url: configuredUrl, token: process.env.MARKET_DATA_API_TOKEN }),
  };
}

function resolveOverride(override: MarketDataProviderInput) {
  return typeof override === "function" ? { fetchSnapshot: override } : override;
}

export async function getTerminalMarketData(
  override?: MarketDataProviderInput,
  now = Date.now(),
): Promise<TerminalMarketGatewayResult> {
  const previewOnly = process.env.MARKET_DATA_PROVIDER === "preview";
  console.info("[bullseye:market-data] configuration", getFmpEnvironmentDiagnostics());
  const configured = override ? null : createConfiguredProvider();

  if (!override && (previewOnly || !configured)) {
    return {
      snapshot: createUnavailableSnapshot(),
      gatewayStatus: createUnconfiguredMarketGatewayStatus(previewOnly ? "Preview disabled" : "Not configured"),
      cache: cacheDiagnostics("disabled"),
    };
  }

  const load = async () => {
    const providerName = override
      ? "Terminal provider override"
      : configured!.name;
    const provider = override
      ? resolveOverride(override)
      : configured!.provider;
    const gateway = new LiveMarketGateway({
      provider,
      providerName,
      maxRetries: positiveInteger(process.env.MARKET_DATA_MAX_RETRIES) ?? 1,
      retryDelayMs: positiveInteger(process.env.MARKET_DATA_RETRY_DELAY_MS) ?? 250,
    });
    const snapshot = await gateway.fetchSnapshot(now);
    return { snapshot, gatewayStatus: gateway.getStatus() };
  };

  // Test/provider overrides remain uncached. Production callers share one
  // short-lived verified snapshot per server instance.
  if (override) return { ...await load(), cache: cacheDiagnostics("bypass") };
  const result = await configuredMarketDataCache.getWithStatus(load);
  return { ...result.value, cache: cacheDiagnostics(result.status) };
}

/** Retained for callers that only need the configured low-level adapter. */
export function createTerminalMarketDataProvider(override?: MarketDataProviderInput): MarketDataProviderInput | undefined {
  if (override) return override;
  if (process.env.MARKET_DATA_PROVIDER === "preview") return undefined;
  return createConfiguredProvider()?.provider;
}
