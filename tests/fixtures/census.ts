import type { CensusSeriesQuery } from "../../app/lib/providers/official/census.ts";

export const CENSUS_QUERIES = [
  { metric: "RETAIL_SALES", dataset: "marts", datasetName: "Advance Monthly Retail Trade Survey", unit: "millions of dollars", predicates: { category_code: "441", data_type_code: "SM", seasonally_adj: "yes" } },
  { metric: "HOUSING", dataset: "resconst", datasetName: "New Residential Construction", unit: "thousands of units", predicates: { category_code: "STARTS", data_type_code: "TOTAL", seasonally_adj: "yes" } },
  { metric: "DURABLE_GOODS", dataset: "advm3", datasetName: "Advance Report on Durable Goods", unit: "millions of dollars", predicates: { category_code: "DG", data_type_code: "NO", seasonally_adj: "yes" } },
  { metric: "TRADE", dataset: "ftd", datasetName: "U.S. International Trade in Goods and Services", unit: "millions of dollars", predicates: { category_code: "BOP", data_type_code: "BAL", seasonally_adj: "yes" } },
] as const satisfies readonly CensusSeriesQuery[];

export function censusPayload(query: CensusSeriesQuery, value = "123.4", time = "2026-06") {
  const keys = ["cell_value", "time_slot_date", ...Object.keys(query.predicates)];
  return [
    keys,
    [value, time, ...Object.values(query.predicates)],
  ];
}
