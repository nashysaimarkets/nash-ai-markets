import { createAdminClient } from "../../../utils/supabase/admin.ts";

export const FOUNDING_100_LIMIT = 100;
export type Founding100Programme = "pro" | "elite";
export type Founding100Status = "active" | "forfeited";
export type Founding100Availability = {
  status: "available" | "unavailable";
  proRemaining: number | null;
  eliteRemaining: number | null;
};

export type Founding100Record = {
  programme: Founding100Programme;
  position: number;
  email: string;
  status: Founding100Status;
  priceLockActive: boolean;
  earnedAt: string;
  forfeitedAt: string | null;
};

type Founding100Row = {
  programme: unknown;
  position: unknown;
  email: unknown;
  status: unknown;
  price_lock_active: unknown;
  earned_at: unknown;
  forfeited_at: unknown;
};

function normalizeRow(row: Founding100Row): Founding100Record | null {
  if ((row.programme !== "pro" && row.programme !== "elite")
    || (row.status !== "active" && row.status !== "forfeited")
    || typeof row.position !== "number"
    || !Number.isInteger(row.position)
    || row.position < 1
    || row.position > FOUNDING_100_LIMIT
    || typeof row.email !== "string"
    || typeof row.price_lock_active !== "boolean"
    || typeof row.earned_at !== "string"
    || (row.forfeited_at !== null && typeof row.forfeited_at !== "string")) {
    return null;
  }
  return {
    programme: row.programme,
    position: row.position,
    email: row.email,
    status: row.status,
    priceLockActive: row.price_lock_active,
    earnedAt: row.earned_at,
    forfeitedAt: row.forfeited_at,
  };
}

export function founding100Remaining(records: readonly Pick<Founding100Record, "programme" | "position">[], programme: Founding100Programme): number {
  const awardedPositions = new Set(records
    .filter((record) => record.programme === programme)
    .map((record) => record.position));
  return Math.max(0, FOUNDING_100_LIMIT - awardedPositions.size);
}

export function founding100AvailabilityLabel(
  remaining: number | null,
): { label: string; detail: string; full: boolean } {
  if (remaining === null || !Number.isInteger(remaining) || remaining < 0 || remaining > FOUNDING_100_LIMIT) {
    return {
      label: "Founding places available",
      detail: "Live availability is temporarily unavailable. Eligibility is confirmed only after successful subscription.",
      full: false,
    };
  }
  if (remaining === 0) {
    return {
      label: "Founding allocation full",
      detail: "The standard subscription remains available without the Founding lifetime price lock.",
      full: true,
    };
  }
  return {
    label: `${remaining} of ${FOUNDING_100_LIMIT} founding places remaining`,
    detail: "Availability is database-backed and confirmed only after successful subscription.",
    full: false,
  };
}

export function isFounding100Admin(
  email: string | null | undefined,
  configuredEmails = process.env.BULLSEYE_ADMIN_EMAILS,
): boolean {
  if (!email || !configuredEmails) return false;
  const normalized = email.trim().toLowerCase();
  return configuredEmails
    .split(",")
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

async function loadRows(): Promise<{ status: "available"; records: Founding100Record[] } | { status: "unavailable"; records: [] }> {
  try {
    const { data, error } = await createAdminClient()
      .from("founding_100_members")
      .select("programme, position, email, status, price_lock_active, earned_at, forfeited_at")
      .order("programme")
      .order("position");
    if (error || !Array.isArray(data)) return { status: "unavailable", records: [] };
    const records = data.map((row) => normalizeRow(row as Founding100Row));
    if (records.some((record) => record === null)) return { status: "unavailable", records: [] };
    return { status: "available", records: records as Founding100Record[] };
  } catch {
    return { status: "unavailable", records: [] };
  }
}

export async function loadFounding100ForEmail(email: string) {
  const result = await loadRows();
  if (result.status === "unavailable") return result;
  return {
    status: "available" as const,
    records: result.records.filter((record) => record.email === email.trim().toLowerCase()),
  };
}

export async function loadFounding100Report() {
  const result = await loadRows();
  if (result.status === "unavailable") {
    return {
      status: "unavailable" as const,
      proRemaining: null,
      eliteRemaining: null,
      records: [],
    };
  }
  return {
    status: "available" as const,
    proRemaining: founding100Remaining(result.records, "pro"),
    eliteRemaining: founding100Remaining(result.records, "elite"),
    records: result.records,
  };
}

export async function loadFounding100Availability(): Promise<Founding100Availability> {
  try {
    const { data, error } = await createAdminClient()
      .from("founding_100_members")
      .select("programme, position");
    if (error || !Array.isArray(data)) {
      return { status: "unavailable", proRemaining: null, eliteRemaining: null };
    }
    const positions: Array<{ programme: Founding100Programme; position: number }> = [];
    for (const row of data) {
      if ((row.programme !== "pro" && row.programme !== "elite")
        || typeof row.position !== "number"
        || !Number.isInteger(row.position)
        || row.position < 1
        || row.position > FOUNDING_100_LIMIT) {
        return { status: "unavailable", proRemaining: null, eliteRemaining: null };
      }
      positions.push({ programme: row.programme, position: row.position });
    }
    return {
      status: "available",
      proRemaining: founding100Remaining(positions, "pro"),
      eliteRemaining: founding100Remaining(positions, "elite"),
    };
  } catch {
    return { status: "unavailable", proRemaining: null, eliteRemaining: null };
  }
}
