import type { CSSProperties } from "react";
import type { PremiumConfidenceModel } from "../../lib/ai-market-insight.ts";

export function PremiumConfidenceGauge({ model }: { model: PremiumConfidenceModel }) {
  const score = model.available && model.score != null ? model.score : 0;
  const bandClass = model.band.replace(/\s+/g, "-").toLowerCase();

  return (
    <div
      className={`companionConfidence is-${bandClass}${model.available ? "" : " is-empty"}`}
      role="meter"
      aria-label={model.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={model.available ? score : 0}
    >
      <div
        className="companionConfidenceDial"
        style={{ "--confidence": `${score * 3.6}deg` } as CSSProperties}
        aria-hidden="true"
      >
        <div>
          <strong>{model.available ? score : "—"}</strong>
          <span>{model.available ? "/100" : ""}</span>
        </div>
      </div>
      <div className="companionConfidenceCopy">
        <em>{model.band === "Awaiting inputs" ? "Awaiting" : model.band}</em>
        <span>{model.detail}</span>
      </div>
      <div className="companionConfidenceSegments" aria-hidden="true">
        {["Low", "Medium", "High", "Very High"].map((band, index) => {
          const active =
            model.available &&
            ((band === "Low" && score < 40) ||
              (band === "Medium" && score >= 40 && score < 65) ||
              (band === "High" && score >= 65 && score < 80) ||
              (band === "Very High" && score >= 80));
          return <i key={band} className={active ? "is-on" : undefined} data-band={band} style={{ opacity: 0.35 + index * 0.15 }} />;
        })}
      </div>
    </div>
  );
}
