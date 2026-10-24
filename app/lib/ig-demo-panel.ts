/** Browser-safe view only. No session, credential, fetch or account-authority API. */
export const IG_DEMO_PANEL_ENABLED_BY_DEFAULT = false;

export type IgDemoPanelPosition = Readonly<{
  dealId: string;
  epic: string;
  direction: "BUY" | "SELL";
  size: number;
  openLevel: number;
  currency: string;
  chartContext: "EXACT_IG_PRODUCT" | "HOLD_CHART_IDENTITY" | "HOLD_DIFFERENT_PRODUCT";
}>;

export type IgDemoPanelSnapshot = Readonly<{
  environment: "DEMO";
  status: "CONNECTED";
  connectionId: string;
  generation: number;
  observedAt: string;
  expiresAt: string;
  account: Readonly<{
    accountId: string;
    accountType: "CFD" | "PHYSICAL" | "SPREADBET";
    currency: string;
  }>;
  positions: readonly IgDemoPanelPosition[];
  riskContext: "HOLD_MARKET_SPEC_UNVERIFIED";
}>;

export type IgDemoChartIdentity = Readonly<{
  source: "IG_DEMO";
  confirmed: true;
  epic: string;
  accountType: "CFD" | "PHYSICAL" | "SPREADBET";
}>;

/** Product equality is exact, never inferred from 'S&P 500', SPX, ES or US500. */
export function igDemoChartContext(
  epic: string,
  accountType: string,
  chart: IgDemoChartIdentity | undefined,
): IgDemoPanelPosition["chartContext"] {
  if (!chart || chart.source !== "IG_DEMO" || chart.confirmed !== true) return "HOLD_CHART_IDENTITY";
  return chart.epic === epic && chart.accountType === accountType ? "EXACT_IG_PRODUCT" : "HOLD_DIFFERENT_PRODUCT";
}
