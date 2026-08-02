/**
 * Provider auth probe. Uses the application's own clients so no credential
 * material is read, printed or handled here — only outcome status is reported.
 *
 * Usage: node --env-file=.env --import tsx scripts/diagnose-providers.ts
 */
import { generateAIMarketBriefSelection } from "../app/lib/server/ai-market-brief.ts";
import { getTerminalMarketData } from "../app/terminal/lib/terminal-market-data-provider.ts";

function presence(name: string) {
  const raw = process.env[name];
  return raw && raw.trim().length > 0 ? "present" : "MISSING";
}

async function main() {
  console.log("=== environment variable presence (values never read) ===");
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "MARKET_DATA_PROVIDER",
    "FMP_API_KEY",
    "FMP_API_BASE_URL",
  ]) {
    console.log(`${name}: ${presence(name)}`);
  }

  console.log("\n=== market data provider ===");
  try {
    const { snapshot, gatewayStatus } = await getTerminalMarketData();
    console.log({
      status: snapshot.status,
      source: snapshot.source,
      quotes: snapshot.quotes.length,
      levels: snapshot.levels.length,
      events: snapshot.events?.length ?? 0,
      connectionStatus: gatewayStatus.connectionStatus,
      dataClassification: gatewayStatus.dataClassification,
      lastFailureCategory: gatewayStatus.lastFailureCategory ?? null,
    });
  } catch (error) {
    console.error("market data threw:", error);
  }

  console.log("\n=== AI provider ===");
  const started = Date.now();
  try {
    const result = await generateAIMarketBriefSelection({
      marketBias: "neutral",
      tradePermission: "no-trade",
      riskRating: "high",
      confidence: 0,
      availableDrivers: ["Verified delayed ES quote", "Verified VIX quote"],
      availableRisks: ["Confirmation evidence is incomplete"],
    });
    console.log(`ai ok in ${Date.now() - started}ms`, result.selection);
  } catch (error) {
    console.error(`ai failed in ${Date.now() - started}ms`);
    console.error(error);
  }
}

await main();
