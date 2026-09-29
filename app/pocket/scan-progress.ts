export const POCKET_SCAN_STAGES = [
  "PREPARING",
  "MEASURING",
  "SECOND_OPINION",
  "VERIFYING",
  "FINALISING",
] as const;

export type PocketScanStage = (typeof POCKET_SCAN_STAGES)[number];

const STAGE_COPY: Record<PocketScanStage, { title: string; detail: string }> = {
  PREPARING: {
    title: "PREPARING CHARTS",
    detail: "Securing and sizing each chart without changing its evidence.",
  },
  MEASURING: {
    title: "MEASURING VISIBLE EVIDENCE",
    detail: "Reading candles, labels and price-scale geometry one chart at a time.",
  },
  SECOND_OPINION: {
    title: "BUILDING THE SECOND OPINION",
    detail: "Challenging the setup across the supplied timeframes.",
  },
  VERIFYING: {
    title: "VERIFYING LEVELS & LIQUIDITY",
    detail: "Running independent checks where the primary evidence needs support.",
  },
  FINALISING: {
    title: "FINALISING THE REPORT",
    detail: "Applying the trust gate before any result is shown.",
  },
};

export function pocketScanStageIndex(stage: PocketScanStage) {
  return POCKET_SCAN_STAGES.indexOf(stage);
}

export function pocketScanStageCopy(stage: PocketScanStage) {
  return STAGE_COPY[stage];
}

export function formatPocketElapsed(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

