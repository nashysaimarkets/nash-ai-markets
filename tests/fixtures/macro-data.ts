import type {
  EconomicRelease,
  FilingActivity,
  MacroObservation,
  VerifiedMacroContext,
} from "../../app/lib/macro-data.ts";

export const treasury10YearFixture = {
  id: "treasury-us10y-2026-08-10",
  metric: "US10Y",
  value: 4.21,
  unit: "%",
  observationAt: "2026-08-10T19:30:00.000Z",
  retrievedAt: "2026-08-11T12:00:00.000Z",
  freshness: "DAILY",
  source: {
    agency: "U.S. Department of the Treasury",
    dataset: "Daily Treasury Par Yield Curve Rates",
    attribution: "Source: U.S. Department of the Treasury · Daily official yield curve",
  },
} satisfies MacroObservation;

export const federalReserveBroadDollarFixture = {
  id: "fed-broad-dollar-2026-08-10",
  metric: "FED_BROAD_DOLLAR",
  value: 119.42,
  unit: "index",
  observationAt: "2026-08-10T00:00:00.000Z",
  retrievedAt: "2026-08-11T12:00:00.000Z",
  freshness: "DAILY",
  source: {
    agency: "Federal Reserve Board",
    dataset: "Broad Dollar Index",
    attribution: "Source: Federal Reserve Board · Broad Dollar Index · Not DXY",
  },
} satisfies MacroObservation;

export const blsReleaseFixture = {
  id: "bls-employment-situation-2026-09",
  name: "Employment Situation",
  agency: "BLS",
  scheduledAt: "2026-09-04T12:30:00.000Z",
  risk: "HIGH",
} satisfies EconomicRelease;

export const secFilingFixture = {
  id: "sec-example-10q",
  companyName: "Example Corporation",
  cik: "0000000001",
  form: "10-Q",
  filedAt: "2026-08-11T14:05:00.000Z",
  accessionNumber: "0000000001-26-000001",
  source: {
    agency: "U.S. Securities and Exchange Commission",
    dataset: "EDGAR",
    attribution: "Source: SEC EDGAR",
  },
} satisfies FilingActivity;

export const macroContextFixture = {
  generatedAt: "2026-08-11T12:00:00.000Z",
  observations: [treasury10YearFixture, federalReserveBroadDollarFixture],
  releases: [blsReleaseFixture],
  filings: [secFilingFixture],
  availableSources: ["Treasury", "Federal Reserve", "BLS", "SEC"],
  unavailableSources: ["BEA", "Census"],
  status: "partial",
} satisfies VerifiedMacroContext;
