export type TimingBucket = { event: string; platform: string; flow: string; bucket_ms: number; total: number };
export function timingSummaries(rows: TimingBucket[]) {
  const groups = new Map<string, TimingBucket[]>();
  for (const row of rows) {
    if (!Number.isFinite(Number(row.bucket_ms)) || !Number.isFinite(Number(row.total)) || Number(row.total) <= 0) continue;
    const key = `${row.event}:${row.platform}:${row.flow}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((buckets) => {
    const sorted = [...buckets].sort((a,b) => Number(a.bucket_ms)-Number(b.bucket_ms));
    const total = sorted.reduce((sum,row) => sum+Number(row.total),0);
    const upperBound = (fraction: number) => { let cumulative = 0; return Number(sorted.find((row) => { cumulative += Number(row.total); return cumulative >= total*fraction; })!.bucket_ms); };
    return { event: sorted[0].event, platform: sorted[0].platform, flow: sorted[0].flow, total, p50UpperMs: upperBound(.5), p90UpperMs: upperBound(.9) };
  });
}
