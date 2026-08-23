export type RiskDeskInput = {
  accountValue: string;
  riskPercent: string;
  stopDistance: string;
  valuePerPoint: string;
};

export type RiskDeskCalculation = {
  accountValue: number | null;
  riskPercent: number | null;
  cashRisk: number | null;
  riskPerUnit: number | null;
  units: number | null;
};

function positiveNumber(value: string) {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateRiskDesk(input: RiskDeskInput): RiskDeskCalculation {
  const accountValue = positiveNumber(input.accountValue);
  const rawRiskPercent = positiveNumber(input.riskPercent);
  const riskPercent = rawRiskPercent === null ? null : Math.min(rawRiskPercent, 10);
  const stopDistance = positiveNumber(input.stopDistance);
  const valuePerPoint = positiveNumber(input.valuePerPoint);
  const cashRisk = accountValue !== null && riskPercent !== null
    ? accountValue * riskPercent / 100
    : null;
  const riskPerUnit = stopDistance !== null && valuePerPoint !== null
    ? stopDistance * valuePerPoint
    : null;
  const units = cashRisk !== null && riskPerUnit !== null
    ? Math.max(0, Math.floor(cashRisk / riskPerUnit))
    : null;

  return { accountValue, riskPercent, cashRisk, riskPerUnit, units };
}
