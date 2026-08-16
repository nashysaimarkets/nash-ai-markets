export const CLASSIC_PIVOT_LEVELS = ["R3", "R2", "R1", "PIVOT", "S1", "S2", "S3"] as const;

export type ClassicPivotLevel = (typeof CLASSIC_PIVOT_LEVELS)[number];
export type ClassicPivotValues = Record<ClassicPivotLevel, string>;

type ClassicPivotInput = {
  high: string | number;
  low: string | number;
  close: string | number;
};

function positiveNumber(value: string | number): number | null {
  const parsed = Number(String(value).trim().replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateClassicPivotLevels(input: ClassicPivotInput): ClassicPivotValues | null {
  const high = positiveNumber(input.high);
  const low = positiveNumber(input.low);
  const close = positiveNumber(input.close);
  if (high === null || low === null || close === null) return null;
  if (high <= low || close < low || close > high) return null;

  const pivot = (high + low + close) / 3;
  const range = high - low;
  const values = {
    R3: high + 2 * (pivot - low),
    R2: pivot + range,
    R1: 2 * pivot - low,
    PIVOT: pivot,
    S1: 2 * pivot - high,
    S2: pivot - range,
    S3: low - 2 * (high - pivot),
  };

  if (Object.values(values).some((value) => !Number.isFinite(value) || value <= 0)) return null;
  return Object.fromEntries(
    CLASSIC_PIVOT_LEVELS.map((level) => [level, values[level].toFixed(2)]),
  ) as ClassicPivotValues;
}
