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
  const tone = !displayable ? "empty" : value! >= 65 ? "supportive" : value! <= 35 ? "defensive" : "mixed";
  const size = compact ? 128 : 168;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = value == null ? 0 : (value / 100) * circumference;
  const stroke = tone === "supportive" ? "#62e6b1" : tone === "defensive" || tone === "empty" ? "#d9ab52" : "#d8b36a";
  const ticks = Array.from({ length: 12 }, (_, index) => index * 30);

  return (
    <div
      className={`bullseyeGauge is-${tone}${delayed ? " is-delayed" : ""}${compact ? " is-compact" : ""}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
    >
      <div className="bullseyeGaugeDial" style={{ "--gauge-size": `${size}px` } as CSSProperties}>
        <svg viewBox="0 0 140 140" width={size} height={size} aria-hidden="true">
          <defs>
            <filter id="bullseyeGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="70" cy="70" r="62" fill="none" stroke="#1c2a31" strokeWidth="8" />
          <circle cx="70" cy="70" r="46" fill="none" stroke="#24333a" strokeWidth="2" />
          {ticks.map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const x1 = 70 + Math.cos(rad) * 58;
            const y1 = 70 + Math.sin(rad) * 58;
            const x2 = 70 + Math.cos(rad) * 64;
            const y2 = 70 + Math.sin(rad) * 64;
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3a4a44" strokeWidth="1.5" />;
          })}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            transform="rotate(-90 70 70)"
            filter="url(#bullseyeGlow)"
            opacity={displayable ? 1 : 0.45}
          />
          <g fill="none" stroke="#62e6b1" strokeWidth="1.4" opacity="0.55">
            <circle cx="70" cy="70" r="18" />
            <path d="M70 48v8M70 84v8M48 70h8M84 70h8" />
          </g>
          <circle cx="70" cy="70" r="4" fill="#d9ab52" opacity="0.9" />
        </svg>
        <div className="bullseyeGaugeCentre">
          <strong>{formatScoreDisplay(score, displayable)}</strong>
          <span>{displayable ? "confidence" : "not calculated"}</span>
          {delayed ? <em>Delayed</em> : null}
        </div>
      </div>
      {!compact ? (
        <dl>
          <div><dt>Score</dt><dd>{displayable ? `${value}/100` : "Not calculated"}</dd></div>
          <div><dt>Posture</dt><dd>{ready && posture ? posture.replaceAll("_", " ") : "Stand aside"}</dd></div>
          <div><dt>Evidence</dt><dd>{displayable ? "Derived" : "Withheld"}</dd></div>
          <div><dt>Feed</dt><dd>{delayed ? "Delayed" : ready ? "Verified" : "Incomplete"}</dd></div>
        </dl>
      ) : null}
    </div>
  );
}
