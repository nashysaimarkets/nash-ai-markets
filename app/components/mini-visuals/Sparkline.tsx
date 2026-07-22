import { MIN_SPARKLINE_POINTS } from "./mini-visual-data.ts";

type Props = {
  values: number[] | null | undefined;
  tone?: "up" | "down" | "flat" | "neutral";
  label?: string;
  className?: string;
  width?: number;
  height?: number;
  /** Soft area fill under the line for premium instrument cards. */
  filled?: boolean;
};

/** Lightweight SVG sparkline from verified numeric observations only. */
export function Sparkline({
  values,
  tone = "neutral",
  label = "Recent verified trend",
  className = "miniSparkline",
  width = 120,
  height = 28,
  filled = false,
}: Props) {
  if (!values || values.length < MIN_SPARKLINE_POINTS) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padY = 2;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - padY - ((value - min) / span) * (height - padY * 2);
    return { x, y };
  });
  const points = coords.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = filled
    ? `M${coords[0]!.x.toFixed(2)},${height} L${points.replaceAll(" ", " L")} L${coords.at(-1)!.x.toFixed(2)},${height} Z`
    : null;
  const last = values.at(-1)!;
  const first = values[0]!;
  const derivedTone = tone === "neutral"
    ? last > first ? "up" : last < first ? "down" : "flat"
    : tone;
  const gradientId = `sparkFill-${derivedTone}-${Math.round(width)}`;

  return (
    <svg
      className={`${className} is-${derivedTone}${filled ? " is-filled" : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {filled ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      ) : null}
      {area ? <path d={area} fill={`url(#${gradientId})`} /> : null}
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}
