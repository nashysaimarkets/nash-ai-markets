import { clampConfidence } from "../lib/visual-terminal.ts";

export function ConfidenceGauge({ value, label = "Bullseye confidence" }: { value: number; label?: string }) {
  const bounded = clampConfidence(value);
  return (
    <div className="confidenceGauge" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded}>
      <div className="confidenceGaugeDial" style={{ "--confidence": `${bounded * 3.6}deg` } as React.CSSProperties}>
        <div><strong>{bounded}</strong><span>/ 100</span></div>
      </div>
      <span>{label}</span>
    </div>
  );
}
