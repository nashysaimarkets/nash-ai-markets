import { exactAxisPrice } from "./axis-verification.ts";

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
  return exactAxisPrice(value);
}

const finitePositive = (value: number) => Number.isFinite(value) && value > 0 ? value : null;

export function calculateRiskDesk(input: RiskDeskInput): RiskDeskCalculation {
  const accountValue = positiveNumber(input.accountValue);
  const rawRiskPercent = positiveNumber(input.riskPercent);
  const riskPercent = rawRiskPercent === null ? null : Math.min(rawRiskPercent, 10);
  const stopDistance = positiveNumber(input.stopDistance);
  const valuePerPoint = positiveNumber(input.valuePerPoint);
  const cashRisk = accountValue !== null && riskPercent !== null
    ? finitePositive(accountValue * (riskPercent / 100))
    : null;
  const riskPerUnit = stopDistance !== null && valuePerPoint !== null
    ? finitePositive(stopDistance * valuePerPoint)
    : null;
  const rawUnits = cashRisk !== null && riskPerUnit !== null ? Math.floor(cashRisk / riskPerUnit) : null;
  const units = rawUnits !== null && Number.isSafeInteger(rawUnits) && rawUnits >= 0 ? rawUnits : null;

  return { accountValue, riskPercent, cashRisk, riskPerUnit, units };
}
