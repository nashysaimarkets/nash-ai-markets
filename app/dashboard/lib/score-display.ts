/** Customer-facing score display: never treat uncalculated evidence as zero. */

export function formatScoreDisplay(score: number | null | undefined, ready: boolean): string {
  if (!ready || score === null || score === undefined) return "Not calculated";
  return `${score} / 100`;
}

export function scoreIsDisplayable(score: number | null | undefined, ready: boolean): boolean {
  return ready && score !== null && score !== undefined;
}

export function formatConfidenceLabel(ready: boolean): string {
  return ready
    ? "Evidence quality and agreement across verified inputs"
    : "Awaiting sufficient verified inputs — a missing score is not a bearish signal";
}
