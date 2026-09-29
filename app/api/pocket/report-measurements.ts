import { precisionRescueReasons } from "./precision-structure";

/** Only validated geometry from an already authenticated receipt may guide a
 * report. Never pass the signed token or promote context into primary. */
export function cachedReportMeasurements(primary: string | null, context: string | null, currentPrice: string | null) {
  return ([{ role: "PRIMARY", raw: primary, price: currentPrice }, { role: "HIGHER_TIMEFRAME", raw: context, price: null }] as const).flatMap(({ role, raw, price }) => {
    if (!raw) return [];
    try {
      const value = JSON.parse(raw);
      if (precisionRescueReasons(value, price).length) return [];
      return [{ role, instrumentIdentifier: value.instrumentIdentifier, currentPrice: value.currentPrice,
        plotBounds: value.plotBounds, priceScaleAnchors: value.priceScaleAnchors, levels: value.levels,
        liquidityShield: value.liquidityShield }];
    } catch { return []; }
  });
}
