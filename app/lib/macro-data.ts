/**
 * Provider-neutral contracts for slow-moving official macroeconomic data.
 *
 * These types are intentionally separate from MarketSnapshot. Government
 * observations have source-specific publication cadences and must never inherit
 * the intraday freshness clock used by ES/VIX decision support.
 */

export const DATA_FRESHNESS_STATES = [
  "CURRENT",
  "DAILY",
  "SCHEDULED",
  "STALE",
  "UNAVAILABLE",
] as const;

export type DataFreshness = (typeof DATA_FRESHNESS_STATES)[number];

export const MACRO_METRICS = [
  "US2Y",
  "US10Y",
  "US30Y",
  "FED_BROAD_DOLLAR",
  "CPI",
  "CORE_CPI",
  "PAYROLLS",
  "UNEMPLOYMENT",
  "PPI",
  "JOLTS",
  "GDP",
  "PCE",
  "PERSONAL_INCOME",
  "RETAIL_SALES",
  "HOUSING",
  "DURABLE_GOODS",
  "TRADE",
] as const;

export type MacroMetric = (typeof MACRO_METRICS)[number];

export type MacroSource = {
  agency: string;
  dataset: string;
  attribution: string;
};

export type MacroObservation = {
  id: string;
  metric: MacroMetric;
  value: number | null;
  unit: string;
  observationAt: string;
  retrievedAt: string;
  freshness: DataFreshness;
  source: MacroSource;
};

export const ECONOMIC_RELEASE_AGENCIES = ["BLS", "BEA", "CENSUS", "FED"] as const;

export type EconomicReleaseAgency = (typeof ECONOMIC_RELEASE_AGENCIES)[number];

export type EconomicRelease = {
  id: string;
  name: string;
  agency: EconomicReleaseAgency;
  scheduledAt: string;
  risk: "HIGH" | "MED";
  actual?: number | null;
  previous?: number | null;
  sourceUrl?: string;
};

export type FilingActivity = {
  id: string;
  companyName: string;
  cik: string;
  form: string;
  filedAt: string;
  accessionNumber: string;
  source: MacroSource;
};

export type VerifiedMacroContextStatus = "complete" | "partial" | "unavailable";

export type VerifiedMacroContext = {
  generatedAt: string;
  observations: MacroObservation[];
  releases: EconomicRelease[];
  filings: FilingActivity[];
  availableSources: string[];
  unavailableSources: string[];
  status: VerifiedMacroContextStatus;
};
