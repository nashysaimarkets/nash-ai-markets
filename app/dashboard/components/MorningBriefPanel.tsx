import type { MorningBrief } from "../../lib/morning-brief-engine.ts";
import { applyAIMorningBrief } from "../../lib/morning-brief-engine.ts";
import { generateAIMorningBrief } from "../../lib/server/ai-morning-brief.ts";
import { TerminalBadge } from "../../terminal/components/TerminalBadge.tsx";

export async function MorningBriefPanel({
  brief,
  aiEligible,
}: {
  brief: MorningBrief;
  aiEligible: boolean;
}) {
  const aiBrief = aiEligible && brief.mode === "verified"
    ? await generateAIMorningBrief(brief)
    : { status: "not_requested" as const, content: null };
  const morningBrief = applyAIMorningBrief(brief, aiBrief);
  const directionalContext = morningBrief.directionalBias ?? "Not available";

  return (
    <section className={`executiveMorningBrief eliteMorningBrief executiveMorningBrief-${morningBrief.mode}`} aria-labelledby="morning-brief-title">
      <header><div><span>{morningBrief.label}</span><h2 id="morning-brief-title">{morningBrief.headline}</h2>{morningBrief.summary ? <p>{morningBrief.summary}</p> : null}</div><div className="morningBriefBadges"><TerminalBadge label={morningBrief.mode} tone={morningBrief.mode === "verified" ? "positive" : morningBrief.mode === "preview" ? "warning" : "danger"} /><TerminalBadge label={morningBrief.generation === "ai-assisted" ? "AI assisted" : "Deterministic"} tone={morningBrief.generation === "ai-assisted" ? "info" : "neutral"} /></div></header>
      <div className="executiveMorningBriefBody">
        <div className="morningBriefSignal"><span>Directional context</span><strong>{directionalContext === "Not available" ? "Verification in progress" : directionalContext}</strong><small>{morningBrief.confidence === null ? "Decision score activates after provider verification" : `${morningBrief.confidence} / 100 confidence`}</small></div>
        <div><h3>Executive priorities</h3><ol>{morningBrief.priorities.map((priority) => <li key={priority}>{priority}</li>)}</ol></div>
        <div><h3>Session checklist</h3><ul>{morningBrief.checklist.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      {morningBrief.warning
        ? <footer><strong>Safety state:</strong> {morningBrief.warning}<span>{morningBrief.mode === "preview" ? `Preview fixture timestamp: ${morningBrief.asOf}` : "Awaiting first verified update."}</span></footer>
        : <footer><span>As of {morningBrief.asOf} · Refresh after material data or event changes.</span><span>{morningBrief.generation === "ai-assisted" ? "OpenAI summarized verified engine evidence only." : morningBrief.aiStatus === "not_requested" ? "Deterministic brief active for current access." : `Deterministic fallback active · ${morningBrief.aiStatus.replaceAll("_", " ")}.`}</span></footer>}
    </section>
  );
}

export function MorningBriefSkeleton() {
  return (
    <section className="executiveMorningBrief eliteMorningBrief morningBriefStreaming" aria-busy="true" aria-label="Preparing optional AI morning brief">
      <header><div><span className="terminalSkeletonLine skeletonShort" /><span className="terminalSkeletonLine skeletonTitle" /></div><TerminalBadge label="Deterministic core ready" tone="neutral" /></header>
      <div className="executiveMorningBriefBody" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => <div key={index}><span className="terminalSkeletonLine" /><span className="terminalSkeletonLine" /></div>)}
      </div>
    </section>
  );
}
