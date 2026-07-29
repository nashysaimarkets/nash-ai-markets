type Props = {
  value: number | null | undefined;
  label: string;
  ready?: boolean;
  segments?: number;
};

/** Compact evidence meter — hidden when score is not calculated. */
export function EvidenceMeter({ value, label, ready = true, segments = 5 }: Props) {
  if (!ready || value == null || !Number.isFinite(value)) {
    return (
      <div className="miniEvidenceMeter is-empty" aria-label={`${label}: not calculated`}>
        <span className="miniEvidenceLabel">{label}</span>
        <div className="miniEvidenceTrack" aria-hidden="true">
          {Array.from({ length: segments }, (_, index) => <i key={index} />)}
        </div>
        <strong>Not calculated</strong>
      </div>
    );
  }
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const filled = Math.round((clamped / 100) * segments);
  const tone = clamped >= 60 ? "supportive" : clamped <= 40 ? "restrictive" : "balanced";
  return (
    <div className={`miniEvidenceMeter is-${tone}`} aria-label={`${label}: ${clamped} of 100`}>
      <span className="miniEvidenceLabel">{label}</span>
      <div className="miniEvidenceTrack" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}>
        {Array.from({ length: segments }, (_, index) => <i key={index} className={index < filled ? "is-on" : undefined} />)}
      </div>
      <strong>{clamped}<em>/100</em></strong>
    </div>
  );
}
