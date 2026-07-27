import {
  diffSnapshots,
  type AnalysisSnapshotPayload,
  type StoredAnalysisSnapshot,
} from "./market-analysis-snapshot.ts";

export type BriefChangeItem = {
  label: string;
  from: string;
  to: string;
  changed: boolean;
};

export type BriefChangeSummary = {
  available: boolean;
  previousSessionDate: string | null;
  headline: string;
  stateChanges: BriefChangeItem[];
  quoteChanges: BriefChangeItem[];
};

function readable(value: string | number | null): string {
  if (value == null || value === "") return "Unavailable";
  return String(value).replaceAll("_", " ").replaceAll("-", " ");
}

export function summarizeBriefChanges(
  previous: StoredAnalysisSnapshot | null,
  current: AnalysisSnapshotPayload,
): BriefChangeSummary {
  if (!previous) {
    return {
      available: false,
      previousSessionDate: null,
      headline: "A prior preserved session is required before changes can be compared.",
      stateChanges: [],
      quoteChanges: [],
    };
  }

  const diff = diffSnapshots(previous.payload, current);
  const stateChanges: BriefChangeItem[] = [
    { label: "Posture", from: readable(diff.posture.from), to: readable(diff.posture.to), changed: diff.posture.from !== diff.posture.to },
    { label: "Risk", from: readable(diff.risk.from), to: readable(diff.risk.to), changed: diff.risk.from !== diff.risk.to },
    { label: "Permission", from: readable(diff.permission.from), to: readable(diff.permission.to), changed: diff.permission.from !== diff.permission.to },
    { label: "Data quality", from: readable(diff.dataQuality.from), to: readable(diff.dataQuality.to), changed: diff.dataQuality.from !== diff.dataQuality.to },
  ];
  const quoteChanges = diff.quotes
    .filter((quote) => quote.changed)
    .map((quote) => ({
      label: quote.symbol,
      from: readable(quote.from),
      to: readable(quote.to),
      changed: true,
    }));
  const changedCount = stateChanges.filter((item) => item.changed).length + quoteChanges.length;

  return {
    available: true,
    previousSessionDate: previous.session_date,
    headline: changedCount
      ? `${changedCount} preserved condition${changedCount === 1 ? "" : "s"} changed since the prior session.`
      : "The preserved posture, risk, permission and comparable quotes are unchanged.",
    stateChanges,
    quoteChanges,
  };
}
