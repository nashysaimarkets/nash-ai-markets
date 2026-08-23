"use client";

import {
  DashboardWorkspaceControls,
  useDashboardWorkspace,
} from "../components/oracle/DashboardWorkspaceControls.tsx";

export function PreferencesClient() {
  const { prefs, persist } = useDashboardWorkspace();
  return <DashboardWorkspaceControls prefs={prefs} onChange={persist} />;
}
