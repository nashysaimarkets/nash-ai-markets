"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_DASHBOARD_WORKSPACE,
  ESSENTIAL_DASHBOARD_SECTIONS,
  type DashboardSectionId,
  type DashboardWorkspacePrefs,
  readDashboardWorkspace,
  resetDashboardWorkspace,
  writeDashboardWorkspace,
} from "../../lib/oracle/dashboard-workspace.ts";
import { subscribeOracleStorage } from "../../lib/oracle/oracle-storage-bus.ts";

const SECTION_LABELS: Record<DashboardSectionId, string> = {
  "thirty-second": "1 · Overnight / session summary",
  "video-centre": "2 · Video centre",
  weather: "3 · Market weather",
  timeline: "4 · Session timeline",
  "game-plan": "5 · Today’s Game Plan",
  insight: "6 · Bull / bear insight",
  chart: "7 · ES chart",
  posture: "8 · Posture detail",
  opportunity: "9 · Opportunity radar",
  checklist: "10 · Checklist & journal",
  replay: "11 · Market replay",
  conviction: "12 · Conviction",
  internals: "13 · Market internals",
  delight: "14 · Daily note",
};

export function useDashboardWorkspace() {
  const prefs = useSyncExternalStore(
    subscribeOracleStorage,
    () => readDashboardWorkspace(),
    () => ({
      ...DEFAULT_DASHBOARD_WORKSPACE,
      order: [...DEFAULT_DASHBOARD_WORKSPACE.order],
      pinned: [...DEFAULT_DASHBOARD_WORKSPACE.pinned],
      density: DEFAULT_DASHBOARD_WORKSPACE.density,
    }),
  );

  function persist(next: DashboardWorkspacePrefs) {
    writeDashboardWorkspace(next);
  }

  return { prefs, persist };
}

export function DashboardWorkspaceControls({
  prefs,
  onChange,
}: {
  prefs: DashboardWorkspacePrefs;
  onChange: (next: DashboardWorkspacePrefs) => void;
}) {
  function move(id: DashboardSectionId, direction: -1 | 1) {
    const order = [...prefs.order];
    const index = order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    onChange({ ...prefs, order });
  }

  function togglePin(id: DashboardSectionId) {
    if (ESSENTIAL_DASHBOARD_SECTIONS.includes(id)) return;
    const pinned = prefs.pinned.includes(id)
      ? prefs.pinned.filter((item) => item !== id)
      : [...prefs.pinned, id];
    onChange({ ...prefs, pinned });
  }

  return (
    <section className="oracleWorkspace" aria-labelledby="dash-workspace-title">
      <header>
        <div>
          <span className="companionEyebrow">PERSONAL WORKSPACE</span>
          <h2 id="dash-workspace-title">Dashboard layout</h2>
          <p>Stored in this browser only. Essential orientation cards stay visible.</p>
        </div>
        <button type="button" className="oracleResetBtn" onClick={() => onChange(resetDashboardWorkspace())}>
          Restore defaults
        </button>
      </header>

      <label className="oracleWorkspaceFavourite">
        <span>Favourite market</span>
        <select
          value={prefs.favouriteMarketId}
          onChange={(event) => onChange({ ...prefs, favouriteMarketId: event.target.value })}
        >
          <option value="es">ES</option>
          <option value="ixic">Nasdaq Composite (IXIC)</option>
          <option value="qqq">QQQ</option>
          <option value="vix">VIX</option>
          <option value="dxy">DXY</option>
        </select>
      </label>

      <label className="oracleWorkspaceFavourite">
        <span>Density</span>
        <select
          value={prefs.density ?? "comfortable"}
          onChange={(event) =>
            onChange({
              ...prefs,
              density: event.target.value === "compact" ? "compact" : "comfortable",
            })
          }
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </label>

      <ul className="oracleWorkspaceList">
        {prefs.order.map((id) => {
          const essential = ESSENTIAL_DASHBOARD_SECTIONS.includes(id);
          const pinned = prefs.pinned.includes(id);
          return (
            <li key={id}>
              <strong>{SECTION_LABELS[id]}</strong>
              <div className="oracleWorkspaceActions">
                <button type="button" onClick={() => move(id, -1)} aria-label={`Move ${SECTION_LABELS[id]} up`}>
                  Up
                </button>
                <button type="button" onClick={() => move(id, 1)} aria-label={`Move ${SECTION_LABELS[id]} down`}>
                  Down
                </button>
                <button
                  type="button"
                  className={pinned ? "is-on" : undefined}
                  disabled={essential}
                  aria-pressed={pinned}
                  onClick={() => togglePin(id)}
                >
                  {essential ? "Essential" : pinned ? "Pinned" : "Pin"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="oracleWorkspaceNote">
        Unpinned sections stay available below the fold in the default stack. Delayed-data and educational
        disclosures cannot be hidden.
      </p>
    </section>
  );
}
