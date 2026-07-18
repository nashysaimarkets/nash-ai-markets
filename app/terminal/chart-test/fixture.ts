import type { OhlcvPoint } from "../lib/visual-terminal";

const start = 1_768_476_600;
const closes = [6024, 6027, 6025, 6031, 6035, 6032, 6038, 6042, 6039, 6045, 6049, 6046, 6052, 6056, 6053, 6059, 6062, 6058, 6064, 6068, 6065, 6071, 6074, 6070];

export const TERMINAL_CHART_TEST_FIXTURE: readonly OhlcvPoint[] = closes.map((close, index) => {
  const open = index === 0 ? 6021 : closes[index - 1]!;
  return {
    time: start + index * 900,
    open,
    high: Math.max(open, close) + 3 + (index % 2),
    low: Math.min(open, close) - 3 - (index % 3),
    close,
    volume: 8_400 + index * 310 + (index % 4) * 1_250,
  };
});
