import type { BullBearMeterModel } from "../../lib/ai-market-insight.ts";

export function BullBearMeter({ model }: { model: BullBearMeterModel }) {
  const sides = [model.bullish, model.neutral, model.bearish];

  return (
    <section className={`companionBullBear${!model.available ? " is-unavailable" : ""}`} aria-labelledby="bull-bear-title">
      <header>
        <span className="companionEyebrow">PROBABILITY ENGINE</span>
        <h3 id="bull-bear-title">Bull vs Bear</h3>
        <p>
          {model.available
            ? `Dominant educational weight: ${model.dominant}`
            : "Scenario weights unavailable until verified inputs clear."}
        </p>
      </header>

      <ul className="companionBullBearBars">
        {sides.map((side) => (
          <li key={side.label} className={`is-${side.label.toLowerCase()}`}>
            <div className="companionBullBearLabel">
              <strong>{side.label}</strong>
              <em>{model.available ? `${side.probability}%` : "—"}</em>
            </div>
            <div
              className="companionBullBearTrack"
              role="meter"
              aria-label={`${side.label} scenario weight`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={model.available ? side.probability : 0}
              aria-valuetext={model.available ? `${side.probability}%` : "Awaiting verified inputs"}
            >
              {model.available ? <i style={{ width: `${side.probability}%` }} /> : <i className="is-awaiting" />}
            </div>
            <ul className="companionBullBearFactors">
              {side.factors.slice(0, 2).map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <small>{model.disclosure}</small>
    </section>
  );
}
