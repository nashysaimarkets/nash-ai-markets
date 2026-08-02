import type { AiMarketInsightModel } from "../../lib/ai-market-insight.ts";
import { BullBearMeter } from "./BullBearMeter.tsx";
import { PremiumConfidenceGauge } from "./PremiumConfidenceGauge.tsx";

export function AiMarketInsightCard({
  model,
  compact = false,
}: {
  model: AiMarketInsightModel;
  compact?: boolean;
}) {
  return (
    <section
      className={`companionInsight${compact ? " is-compact" : ""}${model.available ? "" : " is-limited"}`}
      aria-labelledby="ai-market-insight-title"
    >
      <header className="companionInsightHeader">
        <div>
          <span className="companionEyebrow">AI MARKET INSIGHT</span>
          <h2 id="ai-market-insight-title">{model.title}</h2>
        </div>
        <PremiumConfidenceGauge model={model.confidence} />
      </header>

      <p className="companionNarrative">{model.narrative}</p>

      <div className="companionInsightMeta">
        {model.watch ? (
          <article>
            <span>Watch</span>
            <strong>{model.watch}</strong>
          </article>
        ) : null}
        {model.opportunity ? (
          <article>
            <span>Opportunity lens</span>
            <strong>{model.opportunity.replace(/^Biggest opportunity:\s*/i, "")}</strong>
          </article>
        ) : null}
        {model.danger ? (
          <article>
            <span>Risk lens</span>
            <strong>{model.danger.replace(/^Biggest danger:\s*/i, "")}</strong>
          </article>
        ) : null}
      </div>

      <BullBearMeter model={model.bullBear} />

      <p className="companionDisclosure">{model.disclosure}</p>
    </section>
  );
}
