"use client";

import { useId, useState } from "react";
import {
  MARKET_CATALOG,
  coverageDetail,
  coverageLabel,
  groupAvailabilityLabel,
  type MarketCoverage,
  type MarketGroup,
  type MarketGroupId,
  type MarketInstrument,
} from "../../lib/markets/market-catalog";

type Selection =
  | { kind: "none" }
  | { kind: "group"; group: MarketGroup }
  | { kind: "instrument"; group: MarketGroup; instrument: MarketInstrument };

function coverageClass(coverage: MarketCoverage): string {
  return `tmCoverage is-${coverage}`;
}

export function MarketsBrowser() {
  const marketsId = useId();
  const [marketsOpen, setMarketsOpen] = useState(true);
  const [openGroup, setOpenGroup] = useState<MarketGroupId | null>("indices");
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [mobileOpen, setMobileOpen] = useState(false);

  function selectGroup(group: MarketGroup) {
    setOpenGroup((current) => (current === group.id ? null : group.id));
    setSelection({ kind: "group", group });
    setMobileOpen(false);
  }

  function selectInstrument(group: MarketGroup, instrument: MarketInstrument) {
    setOpenGroup(group.id);
    setSelection({ kind: "instrument", group, instrument });
    setMobileOpen(false);
  }

  return (
    <div className="tmMarketsLayout">
      <button
        type="button"
        className="tmMarketsMobileToggle"
        aria-expanded={mobileOpen}
        aria-controls={marketsId}
        onClick={() => setMobileOpen((open) => !open)}
      >
        Markets
        <span aria-hidden="true">{mobileOpen ? "▴" : "▾"}</span>
      </button>

      {mobileOpen ? (
        <button type="button" className="tmMarketsBackdrop" aria-label="Close markets" onClick={() => setMobileOpen(false)} />
      ) : null}

      <aside id={marketsId} className={`tmMarketsSidebar${mobileOpen ? " is-open" : ""}`} aria-label="Markets browser">
        <div className="tmMarketsSidebarInner">
          <button
            type="button"
            className="tmMarketsRootToggle"
            aria-expanded={marketsOpen}
            onClick={() => setMarketsOpen((open) => !open)}
          >
            <span>Markets</span>
            <small>Desk taxonomy</small>
            <i aria-hidden="true">{marketsOpen ? "−" : "+"}</i>
          </button>

          {marketsOpen ? (
            <ul className="tmMarketsGroups">
              {MARKET_CATALOG.map((group) => {
                const expanded = openGroup === group.id;
                const groupSelected =
                  (selection.kind === "group" && selection.group.id === group.id) ||
                  (selection.kind === "instrument" && selection.group.id === group.id);
                return (
                  <li key={group.id} className={groupSelected ? "is-active" : undefined}>
                    <button
                      type="button"
                      className="tmMarketsGroupToggle"
                      aria-expanded={expanded}
                      onClick={() => selectGroup(group)}
                    >
                      <span>{group.label}</span>
                      <small>{groupAvailabilityLabel(group)}</small>
                      <i aria-hidden="true">{expanded ? "▾" : "▸"}</i>
                    </button>
                    {expanded ? (
                      <ul className="tmMarketsInstruments">
                        {group.instruments.map((instrument) => {
                          const selected =
                            selection.kind === "instrument" && selection.instrument.id === instrument.id;
                          return (
                            <li key={instrument.id}>
                              <button
                                type="button"
                                className={`tmMarketsInstrument${selected ? " is-selected" : ""}`}
                                onClick={() => selectInstrument(group, instrument)}
                              >
                                <span className="tmMarketsInstrumentName">{instrument.name}</span>
                                <span className="tmMarketsInstrumentMeta">
                                  <code>{instrument.symbol}</code>
                                  <em className={coverageClass(instrument.coverage)}>{coverageLabel(instrument.coverage)}</em>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          <p className="tmMarketsHonesty">
            Browser taxonomy only. Live quotes and charts appear solely from verified provider paths — never invented for these rows.
          </p>
        </div>
      </aside>

      <section className="tmMarketsPanel" aria-live="polite">
        {selection.kind === "none" ? (
          <div className="tmMarketsPlaceholder">
            <span className="tmMarketsEyebrow">Market browser</span>
            <h2>Select a market</h2>
            <p>
              Open Markets on the left, choose a category, then pick an instrument. This panel shows selection and coverage state only —
              charts and prices are not fabricated.
            </p>
          </div>
        ) : null}

        {selection.kind === "group" ? (
          <div className="tmMarketsPlaceholder">
            <span className="tmMarketsEyebrow">{selection.group.label}</span>
            <h2>{selection.group.label}</h2>
            <p>{selection.group.description}</p>
            <p className="tmMarketsCount">
              {selection.group.instruments.length} listed instruments · taxonomy only until a row is selected
            </p>
          </div>
        ) : null}

        {selection.kind === "instrument" ? (
          <div className="tmMarketsPlaceholder">
            <span className="tmMarketsEyebrow">{selection.group.label}</span>
            <h2>{selection.instrument.name}</h2>
            <dl className="tmMarketsFacts">
              <div>
                <dt>Symbol</dt>
                <dd>
                  <code>{selection.instrument.symbol}</code>
                </dd>
              </div>
              <div>
                <dt>Provider symbol</dt>
                <dd>
                  <code>{selection.instrument.providerSymbol ?? "—"}</code>
                </dd>
              </div>
              <div>
                <dt>Coverage</dt>
                <dd>
                  <em className={coverageClass(selection.instrument.coverage)}>
                    {coverageLabel(selection.instrument.coverage)}
                  </em>
                </dd>
              </div>
            </dl>
            <p>{coverageDetail(selection.instrument)}</p>
            {selection.instrument.coverage !== "live" ? (
              <p className="tmMarketsAwaiting" role="status">
                No live quote or chart is shown for this selection.
              </p>
            ) : (
              <p className="tmMarketsLiveNote" role="status">
                Verified live path exists for this symbol elsewhere in the product. This canvas does not invent a chart here yet.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
