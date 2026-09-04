type JsonRecord = Record<string | symbol, unknown>;

/**
 * Vision providers sometimes honour "percentage coordinates" as 0..1
 * fractions and sometimes as 0..100 values. Keep the unit decision beside the
 * geometry so every structural and liquidity validator sees the same frame.
 */
const NORMALIZED_GEOMETRY = Symbol.for("pocket-bullseye.normalized-geometry");

function finite(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function records(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object"))
    : [];
}

function fractionalBounds(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const bounds = value as JsonRecord;
  const coordinates = [bounds.left, bounds.top, bounds.right, bounds.bottom].map(finite);
  if (coordinates.some((coordinate) => coordinate === null)) return false;
  const [left, top, right, bottom] = coordinates as number[];
  return left >= 0 && top >= 0
    && right - left >= .25 && bottom - top >= .25
    && right <= 1.5 && bottom <= 1.5;
}

type AxisRange = { min: number; max: number };
type CoordinateMode = "PERCENT" | "FRACTIONAL" | "INVALID";

function coordinateMode(values: unknown[], range: AxisRange | null, frameIsFractional: boolean, minimum = 2): CoordinateMode {
  const coordinates = values.map(finite).filter((value): value is number => value !== null);
  if (coordinates.length < minimum) return "PERCENT";
  const positiveFractional = coordinates.filter((coordinate) => coordinate > 0 && coordinate <= 1.5);
  const percentOnly = coordinates.filter((coordinate) => coordinate > 1.5);
  // Multiple fractional-looking values mixed with percentage-only values are
  // not a coherent coordinate family. Invalidating them is safer than letting
  // one unit mask the other and accidentally pass a scale validator.
  if (positiveFractional.length > 0 && percentOnly.length > 0) return "INVALID";
  if (!coordinates.every((coordinate) => coordinate >= 0 && coordinate <= 1.5)) return "PERCENT";
  if (frameIsFractional) return "FRACTIONAL";
  if (!range) return "PERCENT";
  const rawFits = coordinates.every((coordinate) => coordinate >= range.min && coordinate <= range.max);
  const scaledFits = coordinates.every((coordinate) => coordinate * 100 >= range.min && coordinate * 100 <= range.max);
  // Percentage bounds are authoritative. Scale a fractional-looking child
  // only when its raw coordinates cannot inhabit that frame but the converted
  // coordinates can. When both fit (for example y=.1,.5,.9 in a 0..100 frame),
  // keep the percentages so an ambiguous tiny span fails downstream checks.
  return !rawFits && scaledFits ? "FRACTIONAL" : "PERCENT";
}

function scale(value: unknown, mode: CoordinateMode) {
  const coordinate = finite(value);
  if (coordinate === null) return value;
  if (mode === "INVALID") return Number.NaN;
  return mode === "FRACTIONAL" ? coordinate * 100 : coordinate;
}

function normalizeBounds(value: unknown, fractional: boolean) {
  if (!value || typeof value !== "object") return value;
  const bounds = value as JsonRecord;
  const normalized = { ...bounds };
  for (const key of ["left", "top", "right", "bottom"] as const) {
    if (key in bounds) {
      const coordinate = scale(bounds[key], fractional ? "FRACTIONAL" : "PERCENT");
      normalized[key] = fractional && typeof coordinate === "number"
        ? Math.max(0, Math.min(100, coordinate))
        : coordinate;
    }
  }
  return normalized;
}

function normalizeAnchors(value: unknown, yRange: AxisRange | null, frameIsFractional: boolean) {
  if (!Array.isArray(value)) return value;
  const anchorRecords = records(value);
  const yMode = coordinateMode(anchorRecords.map((anchor) => anchor.y), yRange, frameIsFractional);
  return value.map((item) => {
    if (!item || typeof item !== "object") return item;
    const anchor = item as JsonRecord;
    const normalized = { ...anchor };
    if ("y" in anchor) normalized.y = scale(anchor.y, yMode);
    return normalized;
  });
}

function normalizeLevels(value: unknown, xRange: AxisRange | null, yRange: AxisRange | null, frameIsFractional: boolean) {
  if (!Array.isArray(value)) return value;
  const levelRecords = records(value);
  const xMode = coordinateMode(levelRecords.flatMap((level) => [level.x, level.x2]), xRange, frameIsFractional);
  const yMode = coordinateMode(levelRecords.flatMap((level) => [level.y, level.y2]), yRange, frameIsFractional);
  return value.map((item) => {
    if (!item || typeof item !== "object") return item;
    const level = item as JsonRecord;
    const normalized = { ...level };
    for (const key of ["x", "x2"] as const) {
      if (key in level) normalized[key] = scale(level[key], xMode);
    }
    for (const key of ["y", "y2"] as const) {
      if (key in level) normalized[key] = scale(level[key], yMode);
    }
    return normalized;
  });
}

function normalizeLiquidityShield(value: unknown, xRange: AxisRange | null, yRange: AxisRange | null, frameIsFractional: boolean) {
  if (!value || typeof value !== "object") return value;
  const shield = value as JsonRecord;
  if (!Array.isArray(shield.zones)) return value;
  const zones = records(shield.zones);
  const points = zones.flatMap((zone) => records(zone.touchPoints));
  const xMode = coordinateMode(points.map((point) => point.x), xRange, frameIsFractional);
  const yMode = coordinateMode(points.map((point) => point.y), yRange, frameIsFractional);
  return {
    ...shield,
    zones: shield.zones.map((item) => {
      if (!item || typeof item !== "object") return item;
      const zone = item as JsonRecord;
      return {
        ...zone,
        touchPoints: Array.isArray(zone.touchPoints) ? zone.touchPoints.map((point) => {
          if (!point || typeof point !== "object") return point;
          const touch = point as JsonRecord;
          const normalized = { ...touch };
          if ("x" in touch) normalized.x = scale(touch.x, xMode);
          if ("y" in touch) normalized.y = scale(touch.y, yMode);
          return normalized;
        }) : zone.touchPoints,
      };
    }),
  };
}

function normalizeFibLevels(value: unknown, yRange: AxisRange | null, frameIsFractional: boolean) {
  if (!Array.isArray(value)) return value;
  const fibs = records(value);
  const yMode = coordinateMode(fibs.map((fib) => fib.y), yRange, frameIsFractional);
  return value.map((item) => {
    if (!item || typeof item !== "object") return item;
    const fib = item as JsonRecord;
    const normalized = { ...fib };
    if ("y" in fib) normalized.y = scale(fib.y, yMode);
    return normalized;
  });
}

function normalizePatterns(value: unknown, xRange: AxisRange | null, yRange: AxisRange | null, frameIsFractional: boolean) {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (!item || typeof item !== "object") return item;
    const pattern = item as JsonRecord;
    if (!pattern.geometry || typeof pattern.geometry !== "object") return item;
    const geometry = pattern.geometry as JsonRecord;
    const patternFrameIsFractional = fractionalBounds(geometry.plotBounds);
    const normalizedPlotBounds = geometry.plotBounds
      ? normalizeBounds(geometry.plotBounds, patternFrameIsFractional)
      : null;
    const patternBounds = normalizedPlotBounds && typeof normalizedPlotBounds === "object" ? normalizedPlotBounds as JsonRecord : null;
    const patternLeft = patternBounds ? finite(patternBounds.left) : null;
    const patternRight = patternBounds ? finite(patternBounds.right) : null;
    const patternTop = patternBounds ? finite(patternBounds.top) : null;
    const patternBottom = patternBounds ? finite(patternBounds.bottom) : null;
    const patternXRange = patternLeft !== null && patternRight !== null && patternRight > patternLeft
      ? { min: patternLeft, max: patternRight }
      : xRange;
    const patternYRange = patternTop !== null && patternBottom !== null && patternBottom > patternTop
      ? { min: patternTop, max: patternBottom }
      : yRange;
    const points = records(geometry.points);
    const patternCoordinateFrameIsFractional = geometry.plotBounds ? patternFrameIsFractional : frameIsFractional;
    const xMode = coordinateMode([...points.map((point) => point.x), geometry.labelX], patternXRange, patternCoordinateFrameIsFractional);
    const yMode = coordinateMode([...points.map((point) => point.y), geometry.labelY], patternYRange, patternCoordinateFrameIsFractional);
    const normalizedGeometry = { ...geometry };
    if (normalizedPlotBounds) normalizedGeometry.plotBounds = normalizedPlotBounds;
    if ("labelX" in geometry) normalizedGeometry.labelX = scale(geometry.labelX, xMode);
    if ("labelY" in geometry) normalizedGeometry.labelY = scale(geometry.labelY, yMode);
    if (Array.isArray(geometry.points)) normalizedGeometry.points = geometry.points.map((point) => {
      if (!point || typeof point !== "object") return point;
      const coordinate = point as JsonRecord;
      const normalized = { ...coordinate };
      if ("x" in coordinate) normalized.x = scale(coordinate.x, xMode);
      if ("y" in coordinate) normalized.y = scale(coordinate.y, yMode);
      return normalized;
    });
    return { ...pattern, geometry: normalizedGeometry };
  });
}

/**
 * Canonicalize all coordinates in a report/precision object to full-image
 * percentages. The non-enumerable symbol makes direct repeated validation
 * idempotent without leaking into JSON or incorrectly blessing a later object
 * spread that injects fresh, unnormalised geometry.
 */
export function canonicalizePocketGeometry(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const geometry = value as JsonRecord;
  if (geometry[NORMALIZED_GEOMETRY] === true) return value;
  const frameIsFractional = fractionalBounds(geometry.plotBounds);
  const normalized = { ...geometry };
  if ("plotBounds" in geometry) normalized.plotBounds = normalizeBounds(geometry.plotBounds, frameIsFractional);
  const bounds = normalized.plotBounds && typeof normalized.plotBounds === "object" ? normalized.plotBounds as JsonRecord : null;
  const left = bounds ? finite(bounds.left) : null;
  const right = bounds ? finite(bounds.right) : null;
  const top = bounds ? finite(bounds.top) : null;
  const bottom = bounds ? finite(bounds.bottom) : null;
  const xRange = left !== null && right !== null && right > left ? { min: left, max: right } : null;
  const yRange = top !== null && bottom !== null && bottom > top ? { min: top, max: bottom } : null;
  if ("priceScaleAnchors" in geometry) normalized.priceScaleAnchors = normalizeAnchors(geometry.priceScaleAnchors, yRange, frameIsFractional);
  if ("levels" in geometry) normalized.levels = normalizeLevels(geometry.levels, xRange, yRange, frameIsFractional);
  if ("fibLevels" in geometry) normalized.fibLevels = normalizeFibLevels(geometry.fibLevels, yRange, frameIsFractional);
  if ("patterns" in geometry) normalized.patterns = normalizePatterns(geometry.patterns, xRange, yRange, frameIsFractional);
  if ("liquidityShield" in geometry) normalized.liquidityShield = normalizeLiquidityShield(geometry.liquidityShield, xRange, yRange, frameIsFractional);
  Object.defineProperty(normalized, NORMALIZED_GEOMETRY, { value: true, enumerable: false });
  return normalized;
}
