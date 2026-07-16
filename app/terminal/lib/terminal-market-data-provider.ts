import { createHttpMarketDataProvider, type MarketDataProviderInput } from "../../lib/market-data.ts";

export function createTerminalMarketDataProvider(override?: MarketDataProviderInput): MarketDataProviderInput | undefined {
  if (override) return override;
  if (process.env.MARKET_DATA_PROVIDER === "preview") return undefined;

  return createHttpMarketDataProvider({
    url: process.env.MARKET_DATA_API_URL,
    token: process.env.MARKET_DATA_API_TOKEN,
  });
}
