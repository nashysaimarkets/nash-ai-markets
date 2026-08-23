"use client";

import { useState } from "react";
import { DashboardWorkspaceControls } from "../../components/oracle/DashboardWorkspaceControls.tsx";
import {
  DEFAULT_DASHBOARD_WORKSPACE,
  type DashboardWorkspacePrefs,
} from "../../lib/oracle/dashboard-workspace.ts";

function examplePreferences(): DashboardWorkspacePrefs {
  return {
    ...DEFAULT_DASHBOARD_WORKSPACE,
    favouriteMarketId: "es",
    pinned: [...DEFAULT_DASHBOARD_WORKSPACE.pinned, "opportunity"],
    order: [...DEFAULT_DASHBOARD_WORKSPACE.order],
    expanded: [],
    density: "comfortable",
  };
}

export function PreviewPreferencesClient() {
  const [prefs, setPrefs] = useState<DashboardWorkspacePrefs>(() => examplePreferences());

  return (
    <>
      <DashboardWorkspaceControls
        prefs={prefs}
        onChange={setPrefs}
        onReset={examplePreferences}
      />
      <p className="oracleWorkspaceNote" role="status">
        Example controls only — changes remain inside this preview and are not saved to the browser or account.
      </p>
    </>
  );
}
