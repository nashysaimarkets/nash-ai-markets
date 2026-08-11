import type { EconomicRelease } from "../../app/lib/macro-data.ts";

export const WINDOW_START = new Date("2026-08-11T00:00:00.000Z");
export const WINDOW_END = new Date("2026-08-18T23:59:59.999Z");

export const BLS_PAYROLLS_RELEASE = {
  id: "bls-payrolls",
  name: "Employment Situation",
  agency: "BLS",
  scheduledAt: "2026-08-14T12:30:00.000Z",
  risk: "HIGH",
  sourceUrl: "https://www.bls.gov/schedule/",
} satisfies EconomicRelease;

export const BEA_PCE_RELEASE = {
  id: "bea-pce",
  name: "Personal Income and Outlays",
  agency: "BEA",
  scheduledAt: "2026-08-13T12:30:00.000Z",
  risk: "HIGH",
  sourceUrl: "https://www.bea.gov/news/schedule",
} satisfies EconomicRelease;

export const FED_RELEASE = {
  id: "fed-minutes",
  name: "FOMC Minutes",
  agency: "FED",
  scheduledAt: "2026-08-12T18:00:00.000Z",
  risk: "HIGH",
  sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
} satisfies EconomicRelease;

export const DUPLICATE_PAYROLLS_RELEASE = {
  ...BLS_PAYROLLS_RELEASE,
  id: "duplicate-payrolls-id",
  name: "  Employment   Situation  ",
} satisfies EconomicRelease;

export const OUTSIDE_WINDOW_RELEASE = {
  id: "census-outside-window",
  name: "Retail Sales",
  agency: "CENSUS",
  scheduledAt: "2026-08-25T12:30:00.000Z",
  risk: "HIGH",
  sourceUrl: "https://www.census.gov/economic-indicators/",
} satisfies EconomicRelease;
