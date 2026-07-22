import { MIN_SPARKLINE_POINTS } from "./mini-visual-data.ts";

type Props = {
  values: number[] | null | undefined;
  tone?: "up" | "down" | "flat" | "neutral";
  label?: string;
  className?: string;
  width?: number;
  height?: number;
};

/** Lightweight SVG sparkline from verified numeric observations only. */
export function Sparkline({
  values,
  tone = "neutral",
  label = "Recent verified trend",
  className = "miniSparkline",
  width = 120,
  height = 28,
}: Props) {
  if (!values || values.length < MIN_SPARKLINE_POINTS) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padY = 2;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - padY - ((value - min) / span) * (height - padY * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const last = values.at(-1)!;
  const first = values[0]!;
  const derivedTone = tone === "neutral"
    ? last > first ? "up" : last < first ? "down" : "flat"
    : tone;

  return (
    <svg
      className={`${className} is-${derivedTone}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}
