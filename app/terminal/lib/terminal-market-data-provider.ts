import {
  createUnconfiguredMarketGatewayStatus,
  LiveMarketGateway,
  type MarketGatewayStatus,
} from "../../lib/live-market-gateway.ts";
import {
  createHttpMarketDataProvider,
  createUnavailableSnapshot,
  type MarketDataProviderInput,
  type MarketSnapshot,
} from "../../lib/market-data.ts";

export type TerminalMarketGatewayResult = {
  snapshot: MarketSnapshot;
  gatewayStatus: MarketGatewayStatus;
};

function resolveOverride(override: MarketDataProviderInput) {
  return typeof override === "function" ? { fetchSnapshot: override } : override;
}

export async function getTerminalMarketData(
  override?: MarketDataProviderInput,
  now = Date.now(),
): Promise<TerminalMarketGatewayResult> {
  const configuredUrl = process.env.MARKET_DATA_API_URL;
  const previewOnly = process.env.MARKET_DATA_PROVIDER === "preview";

  if (!override && (previewOnly || !configuredUrl)) {
    return {
      snapshot: createUnavailableSnapshot(new Date(now).toISOString()),
      gatewayStatus: createUnconfiguredMarketGatewayStatus(previewOnly ? "Preview mode" : "Not configured"),
    };
  }

  const providerName = override
    ? "Terminal provider override"
    : process.env.MARKET_DATA_PROVIDER_NAME?.trim() || "Configured HTTP market provider";
  const provider = override
    ? resolveOverride(override)
    : createHttpMarketDataProvider({
        url: configuredUrl,
        token: process.env.MARKET_DATA_API_TOKEN,
      });
  const gateway = new LiveMarketGateway({ provider, providerName });
  const snapshot = await gateway.fetchSnapshot(now);
  return { snapshot, gatewayStatus: gateway.getStatus() };
}

/** Retained for callers that only need the configured low-level adapter. */
export function createTerminalMarketDataProvider(override?: MarketDataProviderInput): MarketDataProviderInput | undefined {
  if (override) return override;
  if (process.env.MARKET_DATA_PROVIDER === "preview" || !process.env.MARKET_DATA_API_URL) return undefined;
  return createHttpMarketDataProvider({
    url: process.env.MARKET_DATA_API_URL,
    token: process.env.MARKET_DATA_API_TOKEN,
  });
}
