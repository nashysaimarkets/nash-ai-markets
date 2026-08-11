export const BEA_GDP_FIXTURE = {
  BEAAPI: { Results: { Data: [
    { TableName: "T10101", LineNumber: "1", LineDescription: "Gross domestic product", TimePeriod: "2026Q1", DataValue: "0.6", CL_UNIT: "Percent change" },
    { TableName: "T10101", LineNumber: "1", LineDescription: "Gross domestic product", TimePeriod: "2026Q2", DataValue: "2.4", CL_UNIT: "Percent change" },
  ] } },
};

export const BEA_INCOME_FIXTURE = {
  BEAAPI: { Results: { Data: [
    { TableName: "T20600", LineDescription: "Personal income", TimePeriod: "2026M05", DataValue: "25,901.4", CL_UNIT: "Billions of dollars" },
    { TableName: "T20600", LineDescription: "Personal income", TimePeriod: "2026M06", DataValue: "26,010.2", CL_UNIT: "Billions of dollars" },
    { TableName: "T20600", LineDescription: "Personal consumption expenditures", TimePeriod: "2026M06", DataValue: "20,811.5", CL_UNIT: "Billions of dollars" },
  ] } },
};

export const BEA_RELEASE_FIXTURE = {
  "Gross Domestic Product": { release_dates: ["2026-08-26T12:30:00+00:00", "2026-09-30T12:30:00+00:00"] },
  "Personal Income and Outlays": { release_dates: ["2026-08-26T12:30:00+00:00", "2026-09-30T12:30:00+00:00"] },
  file_last_updated: "2026-07-13T08:00:42.402013",
};
