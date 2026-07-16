type MetricChipProps = {
  label: string;
  value: string;
  delta?: string;
  tone?: "positive" | "negative" | "neutral";
};

export function MetricChip({ label, value, delta, tone = "neutral" }: MetricChipProps) {
  return (
    <article className={`metricChip metricChip-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {delta ? <b>{delta}</b> : null}
    </article>
  );
}
