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

export type TerminalMarketGatewayResult = {
  snapshot: MarketSnapshot;
  gatewayStatus: MarketGatewayStatus;
};

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export type FmpEnvironmentDiagnostics = {
  marketDataProviderConfigured: boolean;
  fmpApiKeyConfigured: boolean;
  fmpApiBaseUrlConfigured: boolean;
};

export function getFmpEnvironmentDiagnostics(): FmpEnvironmentDiagnostics {
  return {
    marketDataProviderConfigured: Boolean(process.env.MARKET_DATA_PROVIDER?.trim()),
    fmpApiKeyConfigured: Boolean(process.env.FMP_API_KEY?.trim()),
    fmpApiBaseUrlConfigured: Boolean(process.env.FMP_API_BASE_URL?.trim()),
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
    };
  }

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
}

/** Retained for callers that only need the configured low-level adapter. */
export function createTerminalMarketDataProvider(override?: MarketDataProviderInput): MarketDataProviderInput | undefined {
  if (override) return override;
  if (process.env.MARKET_DATA_PROVIDER === "preview") return undefined;
  return createConfiguredProvider()?.provider;
}
