/**
 * NTP IG DEMO response contract draft.
 *
 * Schema validation only: this does NOT authenticate a session, establish
 * account ownership, license market data, or authorise a customer dashboard.
 * IG /accounts v1 and /positions v2 reference:
 * https://labs.ig.com/reference/accounts.html
 * https://labs.ig.com/reference/positions.html
 *
 * No secrets, fetching, logging, order functions or user routes.
 */
export type IgDemoAccountSummary = Readonly<{
  accountId: string;
  accountType: "CFD" | "PHYSICAL" | "SPREADBET";
  currency: string;
  status: "DISABLED" | "ENABLED" | "SUSPENDED_FROM_DEALING";
  preferred: boolean;
}>;

export type IgDemoPositionSummary = Readonly<{
  dealId: string;
  epic: string;
  direction: "BUY" | "SELL";
  size: number;
  openLevel: number;
  currency: string;
}>;

const MAX_ITEMS = 100;

function contractError(): never {
  // Provider bodies and secrets must never enter exception messages.
  throw new Error("IG_DEMO_UNEXPECTED_RESPONSE_CONTRACT");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return contractError();
  return value as Record<string, unknown>;
}

function entries(value: unknown, key: "accounts" | "positions"): unknown[] {
  const root = record(value);
  const list = root[key];
  if (!Array.isArray(list) || list.length > MAX_ITEMS) return contractError();
  return list;
}

function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,96}$/.test(value)) {
    return contractError();
  }
  return value;
}

function currencyCode(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) return contractError();
  return value;
}

function finiteNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return contractError();
  return value;
}

/**
 * Project only supported identity metadata. Do not display raw IG balances,
 * account names or arbitrary provider fields. Empty arrays are permitted.
 */
export function parseIgDemoAccountSummaries(raw: unknown): readonly IgDemoAccountSummary[] {
  const seen = new Set<string>();
  const result = entries(raw, "accounts").map((entry): IgDemoAccountSummary => {
    const value = record(entry);
    const accountId = identifier(value.accountId);
    if (seen.has(accountId)) return contractError();
    seen.add(accountId);
    const accountType = value.accountType;
    if (accountType !== "CFD" && accountType !== "PHYSICAL" && accountType !== "SPREADBET") {
      return contractError();
    }
    const status = value.status;
    if (status !== "DISABLED" && status !== "ENABLED" && status !== "SUSPENDED_FROM_DEALING") {
      return contractError();
    }
    if (typeof value.preferred !== "boolean") return contractError();
    return Object.freeze({
      accountId,
      accountType,
      currency: currencyCode(value.currency),
      status,
      preferred: value.preferred,
    });
  });
  return Object.freeze(result);
}

/**
 * Project only documented /positions v2 fields. The IG positions response
 * does not authenticate which account was active: callers MUST separately
 * prove the active account/session generation and authorise its owner.
 */
export function parseIgDemoPositionSummaries(raw: unknown): readonly IgDemoPositionSummary[] {
  const seen = new Set<string>();
  const result = entries(raw, "positions").map((entry): IgDemoPositionSummary => {
    const value = record(entry);
    const market = record(value.market);
    const position = record(value.position);
    const dealId = identifier(position.dealId);
    if (seen.has(dealId)) return contractError();
    seen.add(dealId);
    const direction = position.direction;
    if (direction !== "BUY" && direction !== "SELL") return contractError();
    const size = finiteNumber(position.size);
    if (size <= 0) return contractError();
    return Object.freeze({
      dealId,
      epic: identifier(market.epic),
      direction,
      size,
      openLevel: finiteNumber(position.level),
      currency: currencyCode(position.currency),
    });
  });
  return Object.freeze(result);
}
