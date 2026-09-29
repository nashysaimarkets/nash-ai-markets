import { createAdminClient } from "../../../utils/supabase/admin.ts";
import Stripe from "stripe";
import { CAMPAIGN_SOURCES, type CampaignSource } from "../marketing-attribution.ts";

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

export type PocketLaunchMember = {
  id: string;
  email: string;
  status: string;
  joinedAt: string;
  renewsAt: string | null;
  cancellationScheduled: boolean;
  source: CampaignSource;
};

export type PocketAttributionRow = { source: CampaignSource; visits: number; subscriptions: number; conversionPercent: number | null };

export type PocketLaunchMetrics = {
  activeSubscribers: number;
  mrrPence: number;
  collected30dPence: number;
  cancellationScheduled: number;
  cancelled: number;
  failedPayments: number;
};

function stripeSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return typeof subscription === "string" ? subscription : subscription?.id ?? null;
}

function stripeCustomerEmail(customer: Stripe.Subscription["customer"]): string {
  if (typeof customer === "string" || ("deleted" in customer && customer.deleted)) return "Email unavailable";
  return customer.email?.trim().toLowerCase() || "Email unavailable";
}

async function listAll<T extends { id?: string }>(
  load: (startingAfter?: string) => Promise<{ data: T[]; has_more: boolean }>,
  maximum = 1000,
): Promise<T[]> {
  const records: T[] = [];
  let startingAfter: string | undefined;
  while (records.length < maximum) {
    const page = await load(startingAfter);
    records.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) throw new Error("Stripe pagination cursor unavailable");
  }
  if (records.length >= maximum) throw new Error("Stripe launch report exceeded its safe record limit");
  return records;
}

export async function loadPocketLaunchReport() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const pocketPriceId = process.env.STRIPE_POCKET_FOUNDING_PRICE_ID?.trim();
  if (!secretKey || !pocketPriceId) {
    return { status: "unavailable" as const, metrics: null, recentMembers: [], attributionAvailable: false, attribution: [] };
  }
  try {
    const stripe = new Stripe(secretKey);
    const subscriptions = await listAll<Stripe.Subscription>((startingAfter) => stripe.subscriptions.list({
      status: "all",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
      expand: ["data.customer"],
    }));
    const pocketSubscriptions = subscriptions.filter((subscription) =>
      subscription.items.data.some((item) => item.price.id === pocketPriceId),
    );
    const { data: visitData, error: visitError } = await createAdminClient().from("marketing_visits").select("source").eq("campaign", "founding650").limit(10000);
    const attributionAvailable = !visitError && Array.isArray(visitData);
    const visitsBySource = new Map<CampaignSource, number>();
    if (attributionAvailable) for (const row of visitData) if (CAMPAIGN_SOURCES.includes(row.source as CampaignSource)) {
      const source = row.source as CampaignSource;
      visitsBySource.set(source, (visitsBySource.get(source) ?? 0) + 1);
    }
    const subscriptionsBySource = new Map<CampaignSource, number>();
    for (const subscription of pocketSubscriptions) {
      const requested = subscription.metadata.acquisition_source;
      const source = CAMPAIGN_SOURCES.includes(requested as CampaignSource) ? requested as CampaignSource : "direct";
      subscriptionsBySource.set(source, (subscriptionsBySource.get(source) ?? 0) + 1);
    }
    const attribution: PocketAttributionRow[] = CAMPAIGN_SOURCES.map((source) => {
      const visits = visitsBySource.get(source) ?? 0;
      const sourceSubscriptions = subscriptionsBySource.get(source) ?? 0;
      return { source, visits, subscriptions: sourceSubscriptions, conversionPercent: visits > 0 ? Math.round((sourceSubscriptions / visits) * 1000) / 10 : null };
    }).filter((row) => row.visits > 0 || row.subscriptions > 0);
    const active = pocketSubscriptions.filter((subscription) =>
      subscription.status === "active" || subscription.status === "trialing",
    );
    const activeIds = new Set(active.map((subscription) => subscription.id));
    const pocketIds = new Set(pocketSubscriptions.map((subscription) => subscription.id));
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const [paidInvoices, openInvoices] = await Promise.all([
      listAll<Stripe.Invoice>((startingAfter) => stripe.invoices.list({
        status: "paid", created: { gte: since }, limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })),
      listAll<Stripe.Invoice>((startingAfter) => stripe.invoices.list({
        status: "open", limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })),
    ]);
    const metrics: PocketLaunchMetrics = {
      activeSubscribers: active.length,
      mrrPence: active.reduce((sum, subscription) => sum + subscription.items.data.reduce((itemSum, item) => {
        if (item.price.id !== pocketPriceId || item.price.currency !== "gbp") return itemSum;
        const amount = item.price.unit_amount ?? 0;
        const quantity = item.quantity ?? 1;
        return itemSum + amount * quantity;
      }, 0), 0),
      collected30dPence: paidInvoices.reduce((sum, invoice) => {
        const subscriptionId = stripeSubscriptionId(invoice);
        return subscriptionId && pocketIds.has(subscriptionId) && invoice.currency === "gbp"
          ? sum + invoice.amount_paid
          : sum;
      }, 0),
      cancellationScheduled: active.filter((subscription) => subscription.cancel_at_period_end).length,
      cancelled: pocketSubscriptions.filter((subscription) => subscription.status === "canceled").length,
      failedPayments: openInvoices.filter((invoice) => {
        const subscriptionId = stripeSubscriptionId(invoice);
        return Boolean(subscriptionId && activeIds.has(subscriptionId) && invoice.attempt_count > 0);
      }).length,
    };
    const recentMembers: PocketLaunchMember[] = pocketSubscriptions
      .toSorted((a, b) => b.created - a.created)
      .slice(0, 8)
      .map((subscription) => ({
        id: subscription.id,
        email: stripeCustomerEmail(subscription.customer),
        status: subscription.status,
        joinedAt: new Date(subscription.created * 1000).toISOString(),
        renewsAt: subscription.items.data.reduce((latest, item) => Math.max(latest, item.current_period_end ?? 0), 0)
          ? new Date(subscription.items.data.reduce((latest, item) => Math.max(latest, item.current_period_end ?? 0), 0) * 1000).toISOString()
          : null,
        cancellationScheduled: subscription.cancel_at_period_end,
        source: CAMPAIGN_SOURCES.includes(subscription.metadata.acquisition_source as CampaignSource) ? subscription.metadata.acquisition_source as CampaignSource : "direct",
      }));
    return { status: "available" as const, metrics, recentMembers, attributionAvailable, attribution };
  } catch (error) {
    console.error("Pocket launch reporting unavailable", {
      category: "owner_launch_report_failure",
      message: error instanceof Error ? error.message : "unknown",
    });
    return { status: "unavailable" as const, metrics: null, recentMembers: [], attributionAvailable: false, attribution: [] };
  }
}

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
