import type { MarketIntelligence } from "../../lib/market-intelligence-engine.ts";
import type { TradingDecision } from "../../lib/trading-decision-engine.ts";
import type { TradePlan } from "../../lib/structured-trade-planner.ts";
import { ConfidenceGauge } from "./ConfidenceGauge";
import { TerminalBadge } from "./TerminalBadge";

const pretty = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");

export function IntelligenceSummary({ intelligence }: { intelligence: MarketIntelligence }) {
  return <section className="ftCard ftIntelligence"><header><div><span>MARKET INTELLIGENCE</span><h2>Bullseye Intelligence</h2></div><TerminalBadge label={intelligence.actionable ? "Verified" : "Fail closed"} tone={intelligence.actionable ? "positive" : "warning"} /></header><div className="intelligenceBody"><ConfidenceGauge value={intelligence.scores.bullseyeConfidence} /><dl className="scoreGrid"><div><dt>Risk posture</dt><dd>{intelligence.scores.riskOnRiskOff}</dd></div><div><dt>Sentiment</dt><dd>{intelligence.scores.marketSentiment}</dd></div><div><dt>Trend</dt><dd>{intelligence.scores.trend}</dd></div><div><dt>Volatility</dt><dd>{intelligence.scores.volatility}</dd></div></dl></div></section>;
}

export function DecisionSummary({ decision }: { decision: TradingDecision }) {
  const permissionTone = decision.tradePermission === "actionable" ? "positive" : decision.tradePermission === "caution" ? "warning" : "danger";
  return <section className="ftCard ftDecision"><header><div><span>DETERMINISTIC DECISION ENGINE</span><h2>Decision summary</h2></div><TerminalBadge label={pretty(decision.tradePermission)} tone={permissionTone} /></header><div className="decisionMatrix"><div><span>Market bias</span><strong>{pretty(decision.marketBias)}</strong></div><div><span>Risk rating</span><strong>{pretty(decision.riskRating)}</strong></div><div><span>Volatility</span><strong>{pretty(decision.volatilityRegime)}</strong></div><div><span>Posture</span><strong>{pretty(decision.recommendedPosture)}</strong></div></div>{decision.noTradeReasons.length ? <WarningList title="No-trade conditions" values={decision.noTradeReasons} /> : null}</section>;
}

export function PlannerSummary({ plan }: { plan: TradePlan }) {
  return <section className="ftCard ftPlanner"><header><div><span>STRUCTURED TRADE PLANNER</span><h2>Participation plan</h2></div><TerminalBadge label={pretty(plan.executionReadiness)} tone={plan.executionReadiness === "ready" ? "positive" : plan.executionReadiness === "conditional" ? "warning" : "danger"} /></header><div className="plannerLead"><div><span>Directional posture</span><strong>{pretty(plan.directionalPosture)}</strong></div><div><span>Participation</span><strong>{pretty(plan.participationLevel)}</strong></div><div><span>Preferred setup</span><strong>{pretty(plan.preferredSetupType)}</strong></div></div><WarningList title="Required confirmations" values={plan.requiredConfirmations} neutral />{plan.reasonsToRemainSidelined.length ? <WarningList title="Reasons to remain sidelined" values={plan.reasonsToRemainSidelined} /> : null}</section>;
}

export function WarningList({ title, values, neutral = false }: { title: string; values: string[]; neutral?: boolean }) {
  return <div className={`warningList${neutral ? " warningListNeutral" : ""}`}><strong>{title}</strong><ul>{values.map((value) => <li key={value}>{pretty(value)}</li>)}</ul></div>;
}
