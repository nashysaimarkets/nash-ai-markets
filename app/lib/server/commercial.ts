import { createAdminClient } from "../../../utils/supabase/admin.ts";

export type CommercialMembership = {
  email: string;
  plan: "free" | "pro" | "elite";
  status: string;
  billingInterval: "month" | "year" | null;
  unitAmount: number | null;
  periodEnd: string | null;
};

export type CommercialMetrics = {
  free: number;
  pro: number;
  elite: number;
  monthly: number;
  annual: number;
  mrrPence: number;
  arrPence: number;
  conversionPercent: number | null;
};

export type WaitlistMetrics = {
  total: number;
  foundingProInterest: number;
};

export function calculateCommercialMetrics(rows: readonly CommercialMembership[]): CommercialMetrics {
  const active = rows.filter((row) => row.status === "active" || row.status === "trialing");
  const free = rows.filter((row) => row.plan === "free").length;
  const pro = active.filter((row) => row.plan === "pro").length;
  const elite = active.filter((row) => row.plan === "elite").length;
  const paid = active.filter((row) => row.plan === "pro" || row.plan === "elite");
  const monthly = paid.filter((row) => row.billingInterval === "month").length;
  const annual = paid.filter((row) => row.billingInterval === "year").length;
  const monthlyPence = paid.filter((row) => row.billingInterval === "month").reduce((sum, row) => sum + (row.unitAmount ?? 0), 0);
  const annualPence = paid.filter((row) => row.billingInterval === "year").reduce((sum, row) => sum + (row.unitAmount ?? 0), 0);
  const total = free + pro + elite;
  return {
    free,
    pro,
    elite,
    monthly,
    annual,
    mrrPence: Math.round(monthlyPence + annualPence / 12),
    arrPence: monthlyPence * 12 + annualPence,
    conversionPercent: total > 0 ? Math.round(((pro + elite) / total) * 1000) / 10 : null,
  };
}

function normalize(row: Record<string, unknown>): CommercialMembership | null {
  if ((row.plan !== "free" && row.plan !== "pro" && row.plan !== "elite")
    || typeof row.email !== "string"
    || typeof row.status !== "string"
    || (row.billing_interval !== null && row.billing_interval !== "month" && row.billing_interval !== "year")
    || (row.unit_amount !== null && (typeof row.unit_amount !== "number" || row.unit_amount < 0))
    || (row.current_period_end !== null && typeof row.current_period_end !== "string")) return null;
  return {
    email: row.email,
    plan: row.plan,
    status: row.status,
    billingInterval: row.billing_interval,
    unitAmount: row.unit_amount,
    periodEnd: row.current_period_end,
  };
}

async function loadCommercialRows() {
  try {
    const { data, error } = await createAdminClient().from("memberships")
      .select("email, plan, status, billing_interval, unit_amount, current_period_end");
    if (error || !Array.isArray(data)) return null;
    const rows = data.map((row) => normalize(row as Record<string, unknown>));
    return rows.some((row) => row === null) ? null : rows as CommercialMembership[];
  } catch {
    return null;
  }
}

export async function loadCommercialMembership(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { status: "unavailable" as const, membership: null };
  try {
    const { data, error } = await createAdminClient()
      .from("memberships")
      .select("email, plan, status, billing_interval, unit_amount, current_period_end")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (error) return { status: "unavailable" as const, membership: null };
    if (!data) return { status: "available" as const, membership: null };
    const membership = normalize(data as Record<string, unknown>);
    return membership
      ? { status: "available" as const, membership }
      : { status: "unavailable" as const, membership: null };
  } catch {
    return { status: "unavailable" as const, membership: null };
  }
}

export async function loadCommercialReport() {
  const rows = await loadCommercialRows();
  if (!rows) return { status: "unavailable" as const, metrics: null, rows: [] };
  try {
    const admin = createAdminClient();
    let totalRegistered = 0;
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return { status: "unavailable" as const, metrics: null, rows: [] };
      totalRegistered += data.users.length;
      if (data.users.length < 1000) break;
      if (page === 100) return { status: "unavailable" as const, metrics: null, rows: [] };
    }
    const base = calculateCommercialMetrics(rows);
    const paid = base.pro + base.elite;
    const metrics = {
      ...base,
      free: Math.max(0, totalRegistered - paid),
      conversionPercent: totalRegistered > 0 ? Math.round((paid / totalRegistered) * 1000) / 10 : null,
    };
    return { status: "available" as const, metrics, rows };
  } catch {
    return { status: "unavailable" as const, metrics: null, rows: [] };
  }
}

export async function loadWaitlistMetrics() {
  try {
    const admin = createAdminClient();
    const [totalResult, foundingProResult] = await Promise.all([
      admin.from("launch_waitlist").select("*", { count: "exact", head: true }),
      admin.from("launch_waitlist").select("*", { count: "exact", head: true }).eq("source", "homepage"),
    ]);
    if (totalResult.error || foundingProResult.error
      || typeof totalResult.count !== "number"
      || typeof foundingProResult.count !== "number") {
      return { status: "unavailable" as const, metrics: null };
    }
    return {
      status: "available" as const,
      metrics: {
        total: totalResult.count,
        foundingProInterest: foundingProResult.count,
      } satisfies WaitlistMetrics,
    };
  } catch {
    return { status: "unavailable" as const, metrics: null };
  }
}
