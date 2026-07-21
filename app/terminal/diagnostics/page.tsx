import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";
import { getLaunchEmailReadiness } from "../../lib/launch-email";
import { analyzeMarketSnapshot } from "../../lib/market-intelligence-engine";
import { checkOpenAIConnection } from "../../lib/server/openai";
import { createTradingDecision } from "../../lib/trading-decision-engine";
import { createStructuredTradePlan } from "../../lib/structured-trade-planner";
import { LaunchDiagnosticsPanel } from "../components/LaunchDiagnosticsPanel";
import { getFmpEnvironmentDiagnostics, getTerminalMarketData } from "../lib/terminal-market-data-provider";
import { createLaunchDiagnostics } from "../lib/launch-diagnostics";
import { createProgressiveAccess, membershipRedirect, resolveMembershipTier } from "../lib/membership-entitlement";
import { loadPreviewClaims } from "../lib/preview-access";
import { chartDataForStatus, chartDisplayState } from "../lib/visual-terminal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Launch Diagnostics | Bullseye", robots: { index: false, follow: false } };

export default async function TerminalDiagnosticsPage() {
  if (process.env.NODE_ENV === "production") redirect("/terminal");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  const { data: membership, error: membershipError } = await supabase.from("memberships").select("plan, status, current_period_end").ilike("email", user.email).in("plan", ["free", "pro", "elite"]).maybeSingle();
  const tier = resolveMembershipTier(membership, Boolean(membershipError));
  if (tier === "temporarily_unavailable") redirect(membershipRedirect(tier));
  const previewState = await loadPreviewClaims(user.id);
  const access = createProgressiveAccess(tier, previewState.claims);
  if (!access.features["launch-diagnostics"]) redirect("/terminal");

  const [{ snapshot, gatewayStatus, cache }, openAIHealth] = await Promise.all([
    getTerminalMarketData(),
    checkOpenAIConnection(),
  ]);
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({ intelligence, reasoning: intelligence.reasoning, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const plan = createStructuredTradePlan({ decision, intelligence, dataStatus: snapshot.status, providerStatus: gatewayStatus.connectionStatus, dataAgeMs: gatewayStatus.dataAgeMs, fallbackActive: gatewayStatus.fallbackActive, missingDataWarnings: intelligence.reasoning.missingDataWarnings });
  const chart = chartDataForStatus(snapshot.status);
  const diagnostics = createLaunchDiagnostics({
    snapshot, gatewayStatus, intelligence, decision, plan,
    chartState: chartDisplayState([...chart.data]),
    providerType: process.env.MARKET_DATA_PROVIDER,
    apiCredentialConfigured: Boolean(process.env.FMP_API_KEY),
    providerEnvironment: getFmpEnvironmentDiagnostics(),
    requestCache: cache,
    accessibilityContract: true,
    openAIHealth,
    openAIConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    openAIModelConfigured: Boolean(process.env.OPENAI_BRIEF_MODEL?.trim()),
    launchEmailReadiness: getLaunchEmailReadiness(),
  });

  return (
    <main className="diagnosticsPage">
      <header>
        <div>
          <span>INTERNAL · MEMBER ACCESS</span>
          <h1>Bullseye launch diagnostics</h1>
          <p>Safe operational metadata only. Credentials, provider URLs, raw responses and raw errors are never displayed.</p>
        </div>
        <Link href="/terminal">← Return to terminal</Link>
      </header>
      <LaunchDiagnosticsPanel diagnostics={diagnostics} />
      <section className="ftCard buildDiagnostics">
        <header>
          <div>
            <span>BUILD PROVENANCE</span>
            <h2>Candidate metadata</h2>
          </div>
        </header>
        <dl>
          <div><dt>Environment</dt><dd>{diagnostics.environment.mode}</dd></div>
          <div><dt>Application version</dt><dd>{diagnostics.environment.applicationVersion}</dd></div>
          <div><dt>Build timestamp</dt><dd>{diagnostics.environment.buildTimestamp}</dd></div>
          <div><dt>Git commit</dt><dd>{diagnostics.environment.gitCommit}</dd></div>
          <div><dt>Verified tests</dt><dd>{diagnostics.environment.testTotal ?? "Unavailable"}</dd></div>
          <div><dt>Cache status</dt><dd>{diagnostics.cacheStatus}</dd></div>
          <div><dt>Reconnect attempts</dt><dd>{diagnostics.provider.reconnectAttempts}</dd></div>
          <div><dt>Warnings</dt><dd>{diagnostics.warnings.length}</dd></div>
          <div><dt>OpenAI</dt><dd>{diagnostics.integrations.openAI.status.replaceAll("_", " ")}</dd></div>
          <div><dt>AI brief model</dt><dd>{diagnostics.integrations.openAI.modelConfigured ? "Configured" : "Not configured"}</dd></div>
          <div><dt>Launch email</dt><dd>{diagnostics.integrations.launchEmail.ready ? "Ready" : "Not configured"}</dd></div>
        </dl>
      </section>
    </main>
  );
}
