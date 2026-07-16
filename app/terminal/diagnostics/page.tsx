import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";
import { analyzeMarketSnapshot } from "../../lib/market-intelligence-engine";
import { createTradingDecision } from "../../lib/trading-decision-engine";
import { createStructuredTradePlan } from "../../lib/structured-trade-planner";
import { LaunchDiagnosticsPanel } from "../components/LaunchDiagnosticsPanel";
import { getTerminalMarketData } from "../lib/terminal-market-data-provider";
import { createLaunchDiagnostics } from "../lib/launch-diagnostics";
import { chartDataForStatus, chartDisplayState } from "../lib/visual-terminal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Launch Diagnostics | Bullseye", robots: { index: false, follow: false } };

export default async function TerminalDiagnosticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  const { data: membership } = await supabase.from("memberships").select("plan, status, current_period_end").ilike("email", user.email).in("status", ["active", "trialing"]).in("plan", ["pro", "elite"]).maybeSingle();
  if (!membership) redirect("/?membership=required#membership");

  const { snapshot, gatewayStatus } = await getTerminalMarketData();
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const chart = chartDataForStatus(snapshot.status);
  const diagnostics = createLaunchDiagnostics({
    snapshot, gatewayStatus, intelligence, decision, plan,
    chartState: chartDisplayState([...chart.data]),
    providerType: process.env.MARKET_DATA_PROVIDER,
    apiCredentialConfigured: Boolean(process.env.FMP_API_KEY),
    accessibilityContract: true,
  });

  return <main className="diagnosticsPage"><header><div><span>INTERNAL · MEMBER ACCESS</span><h1>Bullseye launch diagnostics</h1><p>Safe operational metadata only. Credentials, provider URLs and raw errors are never displayed.</p></div><Link href="/terminal">← Return to terminal</Link></header><LaunchDiagnosticsPanel diagnostics={diagnostics} /><section className="ftCard buildDiagnostics"><header><div><span>BUILD PROVENANCE</span><h2>Candidate metadata</h2></div></header><dl><div><dt>Environment</dt><dd>{diagnostics.environment.mode}</dd></div><div><dt>Application version</dt><dd>{diagnostics.environment.applicationVersion}</dd></div><div><dt>Build timestamp</dt><dd>{diagnostics.environment.buildTimestamp}</dd></div><div><dt>Git commit</dt><dd>{diagnostics.environment.gitCommit}</dd></div><div><dt>Verified tests</dt><dd>{diagnostics.environment.testTotal}</dd></div><div><dt>Cache status</dt><dd>{diagnostics.cacheStatus}</dd></div><div><dt>Reconnect attempts</dt><dd>{diagnostics.provider.reconnectAttempts}</dd></div><div><dt>Warnings</dt><dd>{diagnostics.warnings.length}</dd></div></dl></section></main>;
}
