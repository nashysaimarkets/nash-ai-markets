import Link from "next/link";

export type LevelMapItem = {
  label: string;
  value: string;
  kind?: "high" | "low" | "open" | "mid" | "ema" | "price" | "other";
};

function parsePts(value: string): number | null {
  const n = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Ordered vertical map of verified ES references.
 * Positions are derived only from the numeric values already supplied — never invented.
 */
export function VisualLevelMap({
  levels,
  currentPrice,
  note,
}: {
  levels: LevelMapItem[];
  currentPrice?: string | null;
  note?: string | null;
}) {
  const items: LevelMapItem[] = [...levels];
  if (currentPrice) {
    items.push({ label: "Current price", value: currentPrice, kind: "price" });
  }

  const parsed = items
    .map((item) => ({ ...item, n: parsePts(item.value) }))
    .filter((item): item is LevelMapItem & { n: number } => item.n != null);

  if (!parsed.length) {
    return (
      <div className="dashLevelMap is-empty" role="status">
        <span className="dashStatusBadge is-muted">Awaiting verified levels</span>
        <p>{note ?? "ES reference levels appear once verified 24-hour candles are available."}</p>
        <Link href="/terminal?market=es&view=charts" className="dashTextLink">
          Open full chart on Trading Desk
        </Link>
      </div>
    );
  }

  const lows = parsed.map((item) => item.n);
  const min = Math.min(...lows);
  const max = Math.max(...lows);
  const span = max - min || 1;

  const positioned = [...parsed]
    .sort((a, b) => b.n - a.n)
    .map((item) => ({
      ...item,
      pct: ((item.n - min) / span) * 100,
      kind:
        item.kind ??
        (/high|upside/i.test(item.label)
          ? "high"
          : /low|downside/i.test(item.label)
            ? "low"
            : /open/i.test(item.label)
              ? "open"
              : /mid/i.test(item.label)
                ? "mid"
                : /ema/i.test(item.label)
                  ? "ema"
                  : /current/i.test(item.label)
                    ? "price"
                    : "other"),
    }));

  return (
    <div className="dashLevelMap">
      <div className="dashLevelMapTrack" aria-hidden="true">
        <i className="dashLevelMapRail" />
        {positioned.map((item) => (
          <span
            key={`${item.label}-${item.value}`}
            className={`dashLevelMapMarker is-${item.kind}`}
            style={{ bottom: `${item.pct}%` }}
          />
        ))}
      </div>
      <ol className="dashLevelMapList">
        {positioned.map((item) => (
          <li key={`${item.label}-${item.value}`} className={`is-${item.kind}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ol>
      {note ? <p className="dashLevelsNote">{note}</p> : null}
      <Link href="/terminal?market=es&view=charts" className="dashTextLink">
        Open full chart on Trading Desk
      </Link>
    </div>
  );
}
