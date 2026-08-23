/**
 * Visual confidence ring from an existing band/label.
 * Never invents a percentage — when inactive it shows "Awaiting" with a dashed ring.
 */
export function ConfidenceRing({
  label,
  detail,
  active,
  tone = "info",
}: {
  label: string;
  detail?: string | null;
  active: boolean;
  tone?: "positive" | "info" | "caution" | "warning" | "risk" | "neutral";
}) {
  return (
    <div
      className={`dashConfidenceRing is-${tone}${active ? "" : " is-inactive"}`}
      role="status"
      aria-label={active ? `Confidence: ${label}` : "Confidence awaiting confirmation"}
    >
      <div className="dashConfidenceRingDial" aria-hidden="true">
        <strong>{active ? label : "—"}</strong>
      </div>
      <div className="dashConfidenceRingCopy">
        <em>{active ? "Confidence" : "Awaiting confirmation"}</em>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}
