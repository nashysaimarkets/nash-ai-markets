import type { CSSProperties } from "react";
import { formatScoreDisplay, scoreIsDisplayable } from "../../dashboard/lib/score-display.ts";

type Props = {
  score: number | null | undefined;
  ready: boolean;
  posture?: string | null;
  delayed?: boolean;
  label?: string;
  compact?: boolean;
};

/** Circular Bullseye score gauge — never presents an uncalculated score as zero. */
export function BullseyeGauge({
  score,
  ready,
  posture = null,
  delayed = false,
  label = "Bullseye Score",
  compact = false,
}: Props) {
  const displayable = scoreIsDisplayable(score, ready);
  const value = displayable && typeof score === "number" ? Math.max(0, Math.min(100, Math.round(score))) : null;
  const degrees = value == null ? 0 : value * 3.6;
  const tone = !displayable ? "empty" : value! >= 65 ? "supportive" : value! <= 35 ? "defensive" : "mixed";

  return (
    <div className={`bullseyeGauge is-${tone}${delayed ? " is-delayed" : ""}${compact ? " is-compact" : ""}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
      <div className="bullseyeGaugeDial" style={{ "--gauge": `${degrees}deg` } as CSSProperties}>
        <div>
          <strong>{formatScoreDisplay(score, displayable)}</strong>
          {displayable ? <span>evidence agreement</span> : <span>Awaiting verified inputs</span>}
        </div>
      </div>
      {!compact ? <dl>
        <div><dt>Score</dt><dd>{displayable ? `${value}/100` : "Not calculated"}</dd></div>
        <div><dt>Posture</dt><dd>{ready && posture ? posture.replaceAll("_", " ") : "Stand aside"}</dd></div>
        <div><dt>Evidence</dt><dd>{displayable ? "Derived" : "Withheld"}</dd></div>
        <div><dt>Feed</dt><dd>{delayed ? "Delayed" : ready ? "Verified" : "Incomplete"}</dd></div>
      </dl> : null}
    </div>
  );
}
