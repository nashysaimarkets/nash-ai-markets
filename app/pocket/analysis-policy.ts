import { POCKET_IMAGE_SLOTS } from "./chart-images";

type Images = Partial<Record<typeof POCKET_IMAGE_SLOTS[number][0], unknown>>;

/** Scale the work to the uploads, never to a guessed chart timeframe. */
export function pocketAnalysisPolicy(images: Images) {
  const imageCount = POCKET_IMAGE_SLOTS.filter(([field]) => Boolean(images[field])).length;
  const singleChart = imageCount === 1;
  return {
    imageCount,
    parallelPrecision: singleChart,
    reportTimeoutMs: singleChart ? 110_000 : 240_000,
    providerDeadlineMs: singleChart ? 120_000 : 288_000,
    precisionDeadlineMs: singleChart ? 100_000 : 285_000,
    precisionCallTimeoutMs: singleChart ? 50_000 : 240_000,
    reportOutputTokens: singleChart ? 14_000 : 28_000,
    clientTimeoutMs: singleChart ? 125_000 : 305_000,
  };
}

/** A valid negative finding must not trigger another expensive scan. */
export function needsPocketLiquidityRecovery(status: string | undefined) {
  return status !== "VISIBLE_RISK_ZONES" && status !== "NO_VISIBLE_RISK_ZONES";
}
