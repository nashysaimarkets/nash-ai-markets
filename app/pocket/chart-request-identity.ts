/**
 * Monotonic identity for chart-related async work. A completion may update UI
 * only while its snapshot still belongs to the selected chart generation.
 * Deliberately stores no chart bytes or user data.
 */
export function createChartRequestEpoch() {
  let value = 0;
  return {
    begin(): number { value += 1; return value; },
    snapshot(): number { return value; },
    invalidate(): void { value += 1; },
    isCurrent(token: number): boolean { return token === value; },
  };
}
