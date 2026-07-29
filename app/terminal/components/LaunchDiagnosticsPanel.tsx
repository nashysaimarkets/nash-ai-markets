import Link from "next/link";
import { formatMarketGatewayDataAge } from "../../lib/live-market-gateway.ts";
import type { LaunchDiagnostics } from "../lib/launch-diagnostics.ts";
import { TerminalBadge } from "./TerminalBadge";

const tone = (status: "PASS" | "WARN" | "FAIL") => status === "PASS" ? "positive" : status === "WARN" ? "warning" : "danger";

export function LaunchDiagnosticsPanel({ diagnostics, compact = false }: { diagnostics: LaunchDiagnostics; compact?: boolean }) {
  return <section className={`ftCard launchDiagnostics${compact ? " launchDiagnosticsCompact" : ""}`} aria-labelledby="launch-diagnostics-title">
    <header><div><span>SAFE PROVIDER TELEMETRY</span><h2 id="launch-diagnostics-title">Bullseye provider diagnostics</h2></div><TerminalBadge label={diagnostics.readiness.replace("_", " ")} tone={diagnostics.readiness === "READY" ? "positive" : diagnostics.readiness === "DEGRADED" ? "warning" : "danger"} /></header>
    <dl className="launchHealthGrid">
      <div><dt>Provider</dt><dd>{diagnostics.provider.name}</dd></div>
      <div><dt>Connection</dt><dd>{diagnostics.provider.connection.replace("_", " ")}</dd></div>
      <div><dt>Result category</dt><dd>{diagnostics.provider.resultCategory.replaceAll("_", " ")}</dd></div>
      <div><dt>HTTP status category</dt><dd>{diagnostics.provider.httpStatusCategory.replaceAll("_", " ")}</dd></div>
      <div><dt>ES futures HTTP</dt><dd>{diagnostics.provider.endpointStatusCategories.sp500Futures.replaceAll("_", " ")}</dd></div>
      <div><dt>VIX HTTP</dt><dd>{diagnostics.provider.endpointStatusCategories.vix.replaceAll("_", " ")}</dd></div>
      <div><dt>Treasury HTTP</dt><dd>{diagnostics.provider.endpointStatusCategories.treasuryYields.replaceAll("_", " ")}</dd></div>
      <div><dt>US Dollar HTTP</dt><dd>{diagnostics.provider.endpointStatusCategories.usDollarIndex.replaceAll("_", " ")}</dd></div>
      <div><dt>Oil HTTP</dt><dd>{diagnostics.provider.endpointStatusCategories.oil.replaceAll("_", " ")}</dd></div>
      <div><dt>QQQ HTTP</dt><dd>{diagnostics.provider.endpointStatusCategories.qqq.replaceAll("_", " ")}</dd></div>
      <div><dt>Nasdaq HTTP</dt><dd>{diagnostics.provider.endpointStatusCategories.nasdaq.replaceAll("_", " ")}</dd></div>
      <div><dt>Response received</dt><dd>{diagnostics.provider.responseReceived ? "Yes" : "No"}</dd></div>
      <div><dt>Schema recognised</dt><dd>{diagnostics.provider.schemaRecognized ? "Yes" : "No"}</dd></div>
      <div><dt>Verified quote count</dt><dd>{diagnostics.provider.quoteCount}</dd></div>
      <div><dt>Required instruments found</dt><dd>{diagnostics.provider.requiredInstrumentsFound.join(", ") || "None"}</dd></div>
      <div><dt>Required instruments missing</dt><dd>{diagnostics.provider.requiredInstrumentsMissing.join(", ") || "None"}</dd></div>
      <div><dt>Provider timestamp</dt><dd>{diagnostics.provider.providerTimestamp ?? "Unavailable"}</dd></div>
      <div><dt>Classification</dt><dd>{diagnostics.provider.classification}</dd></div>
      <div><dt>API authentication</dt><dd>{diagnostics.provider.apiAuthentication.replaceAll("_", " ")}</dd></div>
      <div><dt>Data freshness</dt><dd>{formatMarketGatewayDataAge(diagnostics.provider.dataAgeMs)}</dd></div>
      <div><dt>Refresh latency</dt><dd>{diagnostics.provider.refreshLatencyMs === null ? "Unavailable" : `${diagnostics.provider.refreshLatencyMs}ms`}</dd></div>
      <div><dt>Last success</dt><dd>{diagnostics.provider.lastSuccessfulUpdate ?? "None"}</dd></div>
      <div><dt>Fallback</dt><dd>{diagnostics.provider.fallbackActive ? "Active" : "Inactive"}</dd></div>
      <div><dt>Request cache</dt><dd>{diagnostics.requestCache.status}</dd></div>
      <div><dt>Cache window</dt><dd>{diagnostics.requestCache.ttlMs > 0 ? `${diagnostics.requestCache.ttlMs / 1000}s` : "Disabled"}</dd></div>
      <div><dt>Cache hits</dt><dd>{diagnostics.requestCache.hits}</dd></div>
      <div><dt>Concurrent requests shared</dt><dd>{diagnostics.requestCache.coalesced}</dd></div>
      <div><dt>Provider loads</dt><dd>{diagnostics.requestCache.providerLoads}</dd></div>
      <div><dt>Estimated upstream calls avoided</dt><dd>{diagnostics.requestCache.estimatedUpstreamRequestsAvoided}</dd></div>
      <div><dt>MARKET_DATA_PROVIDER</dt><dd>{diagnostics.provider.configuration.marketDataProviderConfigured ? "Present" : "Missing"}</dd></div>
      <div><dt>FMP_API_KEY</dt><dd>{diagnostics.provider.configuration.fmpApiKeyConfigured ? "Present" : "Missing"}</dd></div>
      <div><dt>FMP_API_BASE_URL</dt><dd>{diagnostics.provider.configuration.fmpApiBaseUrlConfigured ? "Present" : diagnostics.provider.configuration.defaultBaseUrlActive ? "Default active" : "Missing"}</dd></div>
      <div><dt>FMP_SP500_FUTURES_SYMBOL</dt><dd>{diagnostics.provider.configuration.fmpSp500FuturesSymbolConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>FMP_VIX_SYMBOL</dt><dd>{diagnostics.provider.configuration.fmpVixSymbolConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>FMP_US_DOLLAR_INDEX_SYMBOL</dt><dd>{diagnostics.provider.configuration.fmpUsDollarIndexSymbolConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>FMP_OIL_SYMBOL</dt><dd>{diagnostics.provider.configuration.fmpOilSymbolConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>FMP_QQQ_SYMBOL</dt><dd>{diagnostics.provider.configuration.fmpQqqSymbolConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>FMP_NASDAQ_SYMBOL</dt><dd>{diagnostics.provider.configuration.fmpNasdaqSymbolConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>FMP_REQUEST_TIMEOUT_MS</dt><dd>{diagnostics.provider.configuration.fmpRequestTimeoutConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>MARKET_DATA_MAX_RETRIES</dt><dd>{diagnostics.provider.configuration.marketDataMaxRetriesConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>MARKET_DATA_RETRY_DELAY_MS</dt><dd>{diagnostics.provider.configuration.marketDataRetryDelayConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>NEXT_PUBLIC_SUPABASE_URL</dt><dd>{diagnostics.provider.configuration.supabaseUrlConfigured ? "Present" : "Missing"}</dd></div>
      <div><dt>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</dt><dd>{diagnostics.provider.configuration.supabasePublishableKeyConfigured ? "Present" : "Missing"}</dd></div>
      <div><dt>SUPABASE_SERVICE_ROLE_KEY</dt><dd>{diagnostics.provider.configuration.supabaseServiceRoleKeyConfigured ? "Present" : "Missing"}</dd></div>
      <div><dt>OPENAI_API_KEY</dt><dd>{diagnostics.provider.configuration.openAIApiKeyConfigured ? "Present" : "Missing"}</dd></div>
      <div><dt>OPENAI_BRIEF_MODEL</dt><dd>{diagnostics.provider.configuration.openAIBriefModelConfigured ? "Present" : "Default active"}</dd></div>
      <div><dt>OPENAI_MORNING_BRIEF_MODEL</dt><dd>{diagnostics.provider.configuration.openAIMorningBriefModelConfigured ? "Present" : "Brief model/default active"}</dd></div>
      <div><dt>Provider failure</dt><dd>{diagnostics.provider.lastFailureCategory?.replaceAll("_", " ") ?? "None"}</dd></div>
      <div><dt>Safe failure reason</dt><dd>{diagnostics.provider.failureReason ?? "None"}</dd></div>
      <div><dt>OpenAI health</dt><dd>{diagnostics.integrations.openAI.status.replaceAll("_", " ")}</dd></div>
      <div><dt>Launch email</dt><dd>{diagnostics.integrations.launchEmail.ready ? "Ready" : "Not configured"}</dd></div>
    </dl>
    <div className="launchModeRow" aria-label="Detected market modes">
      <TerminalBadge label={diagnostics.modes.live ? "Live" : "Live inactive"} tone={diagnostics.modes.live ? "positive" : "neutral"} />
      <TerminalBadge label={diagnostics.modes.delayed ? "Delayed" : "Delayed inactive"} tone={diagnostics.modes.delayed ? "warning" : "neutral"} />
      <TerminalBadge label={diagnostics.modes.preview ? "Preview" : "Preview inactive"} tone={diagnostics.modes.preview ? "info" : "neutral"} />
      <TerminalBadge label={diagnostics.modes.offline ? "Offline" : "Online"} tone={diagnostics.modes.offline ? "danger" : "positive"} />
      <TerminalBadge label={diagnostics.provider.staleDetected ? "Stale detected" : "Fresh"} tone={diagnostics.provider.staleDetected ? "danger" : "positive"} />
    </div>
    {!compact ? <div className="launchCheckList">{diagnostics.checks.map((check) => <article key={check.id}><TerminalBadge label={check.status} tone={tone(check.status)} /><div><strong>{check.label}</strong><span>{check.detail}</span></div></article>)}</div> : null}
    {compact ? <Link className="launchDiagnosticsLink" href="/terminal/diagnostics">Open internal diagnostics →</Link> : null}
  </section>;
}
